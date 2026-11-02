# Future Vue integration

Both frontends use the same Node.js API and MySQL database. Import the provided client, adjusting the relative path:

```js
import { createNiahApi } from '../../shared/niah-api.mjs';
let token = null;
const api = createNiahApi({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  getToken: () => token,
});
const session = await api.login(email, password); // Login form inputs.
token = session.token;
const page = await api.listPlants({ search: 'fern', limit: 25, offset: 0 });
if (page.records.length) {
  const details = await api.getPlant(page.records[0].plantId);
  // Render details.record in Vue.
}
// Sign out: token = null. HTTP 401 requires a new sign-in.
```

Keep tokens in memory, handle errors and never hardcode credentials. This prepares the connection; it does not build a website.

| Endpoint | Access |
| --- | --- |
| POST /auth/login | Credentials return token, expiresIn and user |
| GET /auth/me | Signed-in account |
| GET /plants?search=&limit=25&offset=0 | Botanists see owned records; officers see all |
| GET /plants/:plantId | Same ownership checks |
| POST /plants | Botanists create; identical retries are safe |

Records include plantId, ownerId, names, family, heightMetres, morphology, conservationStatus, description, habitatNotes, location, photos, status, sample and timestamps. Optional fields can be absent. Photos use data URLs. Label sample records as fictional.

The website origin must be in backend CORS_ORIGINS; localhost:5173 is configured. Production needs HTTPS. Do not put MySQL credentials in Vue. Officer editing, deletion, approval and reporting endpoints are future work against this same backend.
