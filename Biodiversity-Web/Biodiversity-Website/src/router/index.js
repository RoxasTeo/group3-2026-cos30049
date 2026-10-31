import { createRouter, createWebHashHistory } from 'vue-router'
import { refreshSession } from '../services/authService.js'

import Dashboard from '../views/DashboardView.vue'
import SpeciesList from '../views/SpeciesListView.vue'
import SpeciesDetails from '../views/SpeciesDetailsView.vue'
import SpeciesForm from '../views/SpeciesFormView.vue'
import Login from '../views/LoginView.vue'
import Register from '../views/RegisterView.vue'
import AccessDenied from '../views/AccessDeniedView.vue'
import UserSpeciesView from '../views/UserSpeciesView.vue'
import UserDetailsView from '../views/UserSpeciesDetailView.vue'
import AdminDashboard from '../views/AdminDashboardView.vue'
import AdminDashboardForm from '../views/AdminDashboardFormView.vue'
import MonitoringDashboardView from '../views/MonitoringDashboardView.vue'

import ObservationList from '../views/ObservationListView.vue'
import ObservationDetails from '../views/ObservationDetailsView.vue'

const SpeciesDistribution = () => import('../views/SpeciesDistributionView.vue')

const PlantTracking = () => import('../views/PlantTrackingView.vue')

const Reports = () => import('../views/ReportsView.vue')

const protectedMeta = { requiresAuth: true, roles: ['conservation_officer', 'admin'] }
const explorerMeta = { requiresAuth: true, roles: ['user', 'conservation_officer', 'admin'] }
const adminMeta = { requiresAuth: true, roles: ['admin'] }
const routes = [
  { path: '/tracking', component: PlantTracking, meta: protectedMeta },
  { path: '/reports', component: Reports, meta: { requiresAuth: true, roles: ['conservation_officer', 'admin'] } },
  { path: '/distribution', component: SpeciesDistribution, meta: { requiresAuth: true, roles: ['conservation_officer', 'admin'] } },
  { path: '/observations', component: ObservationList, meta: { requiresAuth: true, roles: ['conservation_officer', 'admin'] } },
  { path: '/observations/:id', component: ObservationDetails, meta: { requiresAuth: true, roles: ['conservation_officer', 'admin'] } },
  { path: '/login', component: Login, meta: { authLayout: true } },
  { path: '/register', component: Register, meta: { authLayout: true } },
  { path: '/access-denied', component: AccessDenied, meta: { authLayout: true } },
  { path: '/', component: Dashboard, meta: protectedMeta },
  { path: '/species-dashboard',component: UserSpeciesView, meta: explorerMeta },
  { path: '/species-dashboard/:id', component: UserDetailsView, meta: explorerMeta },
  { path: '/species', component: SpeciesList, meta: protectedMeta },
  { path: '/species/new', component: SpeciesForm, meta: protectedMeta },
  { path: '/species/:id/edit', component: SpeciesForm, meta: protectedMeta },
  { path: '/species/:id', component: SpeciesDetails, meta: protectedMeta },
  { path: '/admin/users', component: AdminDashboard, meta: adminMeta },
  { path: '/admin/users/add', component: AdminDashboardForm, meta: adminMeta },
  { path: '/monitoring', component: MonitoringDashboardView, meta: protectedMeta },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach(async to => {
  if (!to.meta.requiresAuth) return true
  try {
    const user = await refreshSession()
    if (!user) return { path: '/login', query: { redirect: to.fullPath } }
     const allowedRoles = to.meta.roles || ['user', 'conservation_officer', 'admin']
    
    if (!allowedRoles.includes(user.role)) {
      return '/access-denied'
    }
  } catch { return { path: '/login', query: { redirect: to.fullPath, reason: 'unavailable' } } }
})

export default router
