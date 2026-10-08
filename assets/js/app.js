import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Configured with your project ID: anwxrxievuluqsdjtaig
const SUPABASE_URL = 'https://anwxrxievuluqsdjtaig.supabase.co';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Handle Login Form Submission
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('error-message');

        errorElement.classList.add('hidden');

        // Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            errorElement.textContent = error.message;
            errorElement.classList.remove('hidden');
            return;
        }

        // Check user role in the profiles table
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        if (profileError || !profile) {
            errorElement.textContent = 'User role not assigned. Contact administrator.';
            errorElement.classList.remove('hidden');
            return;
        }

        // Route based on role
        if (profile.role === 'admin') {
            window.location.href = './admin.html';
        } else {
            window.location.href = './student.html';
        }
    });
}

// Global Auth Guard function for protected pages
export async function checkAuth(requiredRole) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = './index.html';
        return null;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', session.user.id)
        .single();

    if (!profile || (requiredRole && profile.role !== requiredRole)) {
        window.location.href = './index.html';
        return null;
    }

    return profile;
}
