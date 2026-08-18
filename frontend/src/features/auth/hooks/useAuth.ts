import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    roles: string[];
    branch_id: string | null;
  };
  mfaRequired?: boolean;
  mfaToken?: string;
  mfaPurpose?: 'setup' | 'verify';
}

export const useLogin = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: async (payload: LoginPayload): Promise<LoginResponse> => {
      const { data } = await api.post<{ data: LoginResponse }>('/api/v1/auth/login', payload);
      return data.data;
    },
    onSuccess: (data) => {
      if (data.mfaRequired && data.mfaToken) {
        localStorage.setItem('mfa_token', data.mfaToken);
        if (data.mfaPurpose === 'setup') {
          navigate('/mfa/setup');
        } else {
          navigate('/mfa/verify');
        }
        return;
      }

      if (data.accessToken && data.user) {
        localStorage.setItem('refresh_token', data.refreshToken || '');
        setAuth({
          id: data.user.id,
          name: data.user.full_name,
          email: data.user.email,
          role: data.user.roles?.[0] || 'admin'
        } as any, data.accessToken);
        navigate('/');
      }
    },
  });
};

export const useLogout = () => {
  const navigate = useNavigate();
  const { clearAuth } = useAuthStore();

  return () => {
    clearAuth();
    navigate('/login');
  };
};
