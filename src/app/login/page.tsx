'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('Invalid email or password');
            } else {
                router.push('/');
                router.refresh();
            }
        } catch {
            setError('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <svg viewBox="0 0 120 126" fill="none">
                        <path d="M20.6927 21.9315C24.5836 18.563 28.4746 17.3538 32.3655 17.3538H87.4528C95.2348 17.3538 99.1257 23.1407 99.1257 28.9276V89.0082C99.1257 94.7951 93.2345 100.582 87.4528 100.582H32.3655C26.5836 100.582 20.6927 96.0043 20.6927 89.0082V21.9315Z" fill="currentColor" />
                        <path d="M39.1055 36.8L39.1055 89.4254H51.2543V60.0127H68.5635V89.4254H80.7123V36.8H68.5635V47.8254H51.2543V36.8H39.1055Z" fill="var(--bg-primary)" />
                    </svg>
                    Notion
                </div>
                <h1>Welcome back</h1>
                <p>Log in to your workspace</p>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Logging in...' : 'Continue'}
                    </button>
                </form>

                <div className="auth-footer">
                    Don&apos;t have an account?{' '}
                    <Link href="/register">Sign up</Link>
                </div>
            </div>
        </div>
    );
}
