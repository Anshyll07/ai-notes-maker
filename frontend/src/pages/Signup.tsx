import React, { useState } from 'react';

interface SignupProps {
    onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        console.log('Signup attempt starting...', { username });

        try {
            console.log('Sending signup request to http://127.0.0.1:5000/api/auth/register');
            const response = await fetch('http://127.0.0.1:5000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            console.log('Signup response status:', response.status);
            const data = await response.json();
            console.log('Signup response data:', data);

            if (response.ok) {
                console.log('Signup successful!');
                setSuccess('Account created! You can now login.');
                setTimeout(onSwitchToLogin, 2000);
            } else {
                console.error('Signup failed:', data.error);
                setError(data.error || 'Signup failed');
            }
        } catch (err) {
            console.error('Signup error:', err);
            setError('Failed to connect to server');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-900 text-white">
            <div className="bg-dark-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-dark-700">
                <h2 className="text-2xl font-bold mb-6 text-center">Create Account</h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded mb-4 text-sm">
                        {success}
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
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded transition-colors"
                    >
                        Sign Up
                    </button>
                </form>

                <div className="mt-4 text-center text-sm text-gray-400">
                    Already have an account?{' '}
                    <button onClick={onSwitchToLogin} className="text-blue-400 hover:text-blue-300">
                        Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Signup;
