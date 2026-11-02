import sharp from 'sharp';
import { createHash } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import { hashPassword, verifyPassword } from './passwords.js';
const loginSchema = z.object({ email: z.email().max(254).transform(s => s.toLowerCase()), password: z.string().min(1).max(256) }).strict();
const text = (max = 500) => z.string().trim().max(max).default('');
const recordSchema = z.object({
  plantId: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,63}$/),
  commonName: text(200), scientificName: text(200), family: text(200), conservationStatus: text(100),
  heightMetres: text(20).refine(value => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 150)), morphology: text(10000),
  description: z.string().trim().min(1).max(10000), habitatNotes: text(10000),
  location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().min(0).max(30).optional(), capturedAt: z.iso.datetime().optional() }).strict(),
  photos: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), data: z.string().max(7000000), caption: text(500) }).strict()).max(4).default([]),
}).strict();
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
export async function createApp({ repository, secret, origins = [], mode = 'mysql' }) {
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters. Configure backend/.env.');
  const dummyHash = await hashPassword('non-user timing comparison');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin(origin, cb) { cb(null, !origin || origins.includes(origin)); } }));
  app.use(express.json({ limit: '28mb' }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'niah-backend', mode }));
  app.get('/api/ready', async (req, res) => {
    try { await repository.ready(); res.json({ status: 'ready', mode, database: mode === 'demo' && !repository.storage?.startsWith('sqlite') ? 'not used' : 'connected', storage: repository.storage || (mode === 'demo' ? 'temporary memory' : 'mysql') }); }
    catch { res.status(503).json({ error: 'Database unavailable. Start MySQL and run npm run db:init.' }); }
  });
  app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await repository.userByEmail(input.email);
    const valid = await verifyPassword(input.password, user?.password_hash || dummyHash);
    if (!valid || !user) return res.status(401).json({ error: 'Invalid email or password.' });
    const token = jwt.sign({}, secret, { subject: String(user.id), expiresIn: '1h', issuer: 'niah-api', audience: 'niah-app', algorithm: 'HS256' });
    res.json({ token, expiresIn: 3600, user: publicUser(user) });
  });
  // Trust the database role, never a role supplied by a mobile URL or request body.
  app.use('/api', async (req, res, next) => {
    let claims;
    try { const match = /^Bearer (\S+)$/.exec(req.headers.authorization || ''); if (!match) throw new Error(); claims = jwt.verify(match[1], secret, { algorithms: ['HS256'], issuer: 'niah-api', audience: 'niah-app' }); }
    catch { return res.status(401).json({ error: 'A valid sign-in token is required.' }); }
    req.user = await repository.userById(claims.sub);
    if (!req.user) return res.status(401).json({ error: 'Account is no longer available.' });
    next();
  });
  app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));
  app.get('/api/plants', async (req, res) => {
    const input = z.object({ search: z.string().max(100).default(''), limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict().parse(req.query);
    res.json({ records: await repository.list(req.user, input.search, input.limit, input.offset), limit: input.limit, offset: input.offset });
  });
  app.get('/api/plants/:plantId', async (req, res) => {
    const record = await repository.get(req.params.plantId.toUpperCase(), req.user);
    if (!record) return res.status(404).json({ error: 'Record not found.' });
    res.json({ record });
  });
  app.post('/api/plants', async (req, res) => {
    if (req.user.role !== 'botanist') return res.status(403).json({ error: 'Only Botanists can submit field records.' });
    const record = recordSchema.parse(req.body);
    if (new Set(record.photos.map(p => p.id)).size !== record.photos.length) return res.status(400).json({ error: 'Photograph IDs must be unique.' });
    // Decode, constrain and re-encode images. Never trust file paths, MIME labels or EXIF.
    try {
      record.photos = await Promise.all(record.photos.map(async photo => {
        const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo.data);
        if (!match) throw new Error('Invalid photograph');
        const bytes = Buffer.from(match[2], 'base64');
        if (bytes.length > 5 * 1024 * 1024 || bytes.length === 0) throw new Error('Image too large');
        const output = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
        return { id: photo.id, caption: photo.caption, uri: `data:image/jpeg;base64,${output.toString('base64')}` };
      }));
    } catch { return res.status(400).json({ error: 'Invalid photograph. Use JPEG, PNG or WebP images up to 5 MB and 40 megapixels.' }); }
    // Hash normalized input so a lost response can be retried without duplicate records.
    record.submissionHash = createHash('sha256').update(JSON.stringify(record)).digest('hex');
    try { res.status(201).json({ record: await repository.create(record, req.user) }); }
    catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const existing = await repository.get(record.plantId, req.user);
      if (!existing || existing.submissionHash !== record.submissionHash) throw error;
      res.status(200).json({ record: existing });
    }
  });
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use((err, req, res, next) => {
    if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid input.', fields: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This plant ID already exists. No record was overwritten.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    console.error('Request failed:', err.code || err.name);
    res.status(500).json({ error: 'The request could not be completed.' });
  });
  return app;
}
