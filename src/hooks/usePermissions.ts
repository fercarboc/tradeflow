import { useSession } from '../context/SessionContext';

export function usePermissions() {
  const { permisos, plan, rol } = useSession();
  return {
    can: (permiso: string) => permisos.includes(permiso),
    plan,
    rol,
  };
}
