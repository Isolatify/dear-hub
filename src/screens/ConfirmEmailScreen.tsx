import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Logo } from '@/components/Logo';
import { Spinner } from '@/components/ui';

export function ConfirmEmailScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resendConfirmation } = useAuth();
  const { toast } = useToast();
  const email = new URLSearchParams(location.search).get('email') ?? '';
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast('Please return to sign up and enter your email again.', 'warning');
      return;
    }

    setResending(true);
    const { error } = await resendConfirmation(email);
    if (error) toast(error, 'error');
    else toast('Verification email sent again.', 'success');
    setResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 w-full max-w-md text-center animate-scale-in">
        <div className="inline-flex items-center justify-center mb-5">
          <Logo size={72} />
        </div>
        <h1 className="text-2xl font-semibold gradient-text">Confirm your email</h1>
        <p className="text-sm text-app-secondary mt-3 leading-relaxed">
          We sent a verification email to
        </p>
        <p className="font-semibold text-app-primary mt-1 break-all">{email || 'your email address'}</p>
        <p className="text-sm text-app-secondary mt-5 leading-relaxed">
          Open the email and tap the <strong>verification button</strong>. After your email is confirmed, you will be taken to the profile setup page.
        </p>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="btn-primary w-full mt-7 flex items-center justify-center gap-2"
        >
          {resending ? <Spinner size={18} /> : 'Resend verification email'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="btn-ghost w-full mt-3"
        >
          Back to sign in
        </button>
        <p className="text-xs text-app-muted mt-6">
          Check your spam or junk folder if you do not see it.
        </p>
        <Link to="/" className="inline-block text-xs text-app-muted hover:text-app-secondary mt-4">
          Back to home
        </Link>
      </div>
    </div>
  );
}
