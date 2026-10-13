import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import Dashboard from './views/DashboardView.vue'
import SpeciesList from './views/SpeciesListView.vue'
import SpeciesDetails from './views/SpeciesDetailsView.vue'
import SpeciesForm from './views/SpeciesFormView.vue'
import './style.css'
import './auth.css'
import Login from './views/LoginView.vue'
import Register from './views/RegisterView.vue'
const router = createRouter({ history: createWebHashHistory(), routes: [
  { path: '/login', component: Login, meta: { authLayout: true } },
  { path: '/register', component: Register, meta: { authLayout: true } },
  { path: '/', component: Dashboard }, { path: '/species', component: SpeciesList },
  { path: '/species/new', component: SpeciesForm }, { path: '/species/:id/edit', component: SpeciesForm },
  { path: '/species/:id', component: SpeciesDetails }, { path: '/:pathMatch(.*)*', redirect: '/' }
], scrollBehavior: () => ({ top: 0 }) })
createApp(App).use(router).mount('#app')
