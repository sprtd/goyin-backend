import { RolesGuard } from '../guards/roles.guards';

export const RolesProviders = [
  {
    provide: 'ROLES',
    useClass: RolesGuard,
  },
];
