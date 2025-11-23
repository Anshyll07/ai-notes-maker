import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
    onSwitchToSignup: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToSignup }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        console.log('Login attempt starting...', { username });

        try {
            console.log('Sending login request to http://127.0.0.1:5000/api/auth/login');
            const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            console.log('Login response status:', response.status);
            const data = await response.json();
            console.log('Login response data:', data);

            if (response.ok) {
                console.log('Login successful, calling login()...');
                login(data.access_token, data.username);
            } else {
                console.error('Login failed:', data.error);
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Failed to connect to server');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-900 text-white">
            <div className="bg-dark-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-dark-700">
                <h2 className="text-2xl font-bold mb-6 text-center">Login to AI Notes</h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition-colors"
                    >
                        Login
                    </button>
                </form>

                <div className="mt-4 text-center text-sm text-gray-400">
                    Don't have an account?{' '}
                    <button onClick={onSwitchToSignup} className="text-blue-400 hover:text-blue-300">
                        Sign up
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
