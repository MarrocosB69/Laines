import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { getRedirectPathFromRole } from '../../constants/roles';

// fallbackCheck: (user) => boolean — permite acesso mesmo sem role na lista
const PrivateRoute = ({ children, allowedRoles, fallbackCheck }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isRoleAllowed = !allowedRoles || allowedRoles.includes(user.role);
  const isFallbackAllowed = fallbackCheck ? fallbackCheck(user) : false;

  if (!isRoleAllowed && !isFallbackAllowed) {
    const destino = getRedirectPathFromRole(user.role, user);

    // Trava anti-laco: o destino calculado pode ser a propria rota que acabou de
    // negar o acesso — o redirect volta para ca, nega de novo, e o resultado e
    // uma tela em branco infinita. Nesse caso mostramos o motivo em vez de
    // navegar. Ver perfis coord_atendimento e diretoria_*.
    if (destino === location.pathname) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Seu perfil ainda não tem uma área liberada
          </h1>
          <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
            O acesso do perfil <strong>{user.role}</strong> a esta área não está configurado.
            Procure a coordenação para liberar as permissões.
          </p>
        </div>
      );
    }

    return <Navigate to={destino} replace />;
  }

  return children;
};

export default PrivateRoute;
