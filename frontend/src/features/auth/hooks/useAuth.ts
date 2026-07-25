import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'manager' | 'cashier';
  };
}

export const useLogin = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: async (payload: LoginPayload): Promise<LoginResponse> => {
      const { data } = await api.post<LoginResponse>('/auth/login', payload);
      return data;
    },
    onSuccess: (data) => {
      localStorage.setItem('refresh_token', data.refreshToken);
      setAuth(data.user, data.accessToken);
      navigate('/');
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
