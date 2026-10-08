import { checkAuth, supabase } from './app.js';

// Enforce Admin Role Access
let currentUser = null;
(async () => {
    currentUser = await checkAuth('admin');
    if (currentUser) {
        loadDashboardStats();
        loadCoursesManager();
    }
})();

// Load Dashboard Metrics
async function loadDashboardStats() {
    const { count: courseCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
    const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
    const { count: lessonCount } = await supabase.from('lessons').select('*', { count: 'exact', head: true });

    document.getElementById('stat-courses').textContent = courseCount || 0;
    document.getElementById('stat-students').textContent = studentCount || 0;
    document.getElementById('stat-modules').textContent = lessonCount || 0;
}

// Render Course & Lesson Creator UI
function loadCoursesManager() {
    const mainContainer = document.querySelector('main');
    
    // Append Course Creation Form & Course List section below the stats
    const managementHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Create Course Card -->
            <div class="bg-slate-800 p-6 rounded-xl border border-slate-700 h-fit">
                <h2 class="text-lg font-semibold mb-4 text-blue-400">Create New Course</h2>
                <form id="create-course-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1 text-slate-300">Course Title</label>
                        <input type="text" id="course-title" required placeholder="e.g., Public Sector Leadership" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1 text-slate-300">Description</label>
                        <textarea id="course-desc" rows="3" placeholder="Course overview..." class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"></textarea>
                    </div>
                    <button type="submit" class="w-full py-2 bg-blue-600 hover:bg-blue-500 font-semibold rounded-lg text-sm transition">Create Course</button>
                </form>
            </div>

            <!-- Existing Courses & Content Upload Manager -->
            <div class="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h2 class="text-lg font-semibold mb-4 text-blue-400">Active Courses & Lessons</h2>
                <div id="admin-course-list" class="space-y-4">
                    <p class="text-slate-400 text-sm">Loading courses...</p>
                </div>
            </div>
        </div>
    `;
    mainContainer.insertAdjacentHTML('beforeend', managementHTML);

    fetchAdminCourses();

    // Handle Course Creation
    document.getElementById('create-course-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('course-title').value;
        const description = document.getElementById('course-desc').value;

        const { error } = await supabase.from('courses').insert([{ title, description }]);
        if (error) {
            alert('Error creating course: ' + error.message);
        } else {
            document.getElementById('create-course-form').reset();
            loadDashboardStats();
            fetchAdminCourses();
        }
    });
}

// Fetch Courses and Embed Lesson Upload Controls
async function fetchAdminCourses() {
    const container = document.getElementById('admin-course-list');
    const { data: courses, error } = await supabase.from('courses').select('*, lessons(*)').order('created_at', { ascending: false });

    if (error || !courses || courses.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-sm">No courses created yet. Use the form to add your first course.</p>`;
        return;
    }

    container.innerHTML = courses.map(course => `
        <div class="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h3 class="font-bold text-slate-200">${course.title}</h3>
                    <p class="text-xs text-slate-400 mt-0.5">${course.description || 'No description provided.'}</p>
                </div>
                <button onclick="window.deleteCourse(${course.id})" class="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-950/40 rounded border border-red-900/50">Delete Course</button>
            </div>

            <div class="mt-4 border-t border-slate-800 pt-3">
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Course Lessons (${course.lessons ? course.lessons.length : 0})</h4>
                <div class="space-y-1 mb-3">
                    ${course.lessons && course.lessons.length > 0 ? course.lessons.map(l => `
                        <div class="flex justify-between items-center text-xs bg-slate-800/80 px-3 py-2 rounded">
                            <span class="text-slate-300">📄 [${l.lesson_type.toUpperCase()}]${l.title}</span>
                            <a href="${l.content_url}" target="_blank" class="text-blue-400 hover:underline">View Asset</a>
                        </div>
                    `).join('') : '<p class="text-xs text-slate-500 italic">No lessons added to this course yet.</p>'}
                </div>

                <!-- Add Lesson Form -->
                <form onsubmit="window.handleUploadLesson(event, ${course.id})" class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    <input type="text" placeholder="Lesson Title" required class="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200">
                    <select class="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200">
                        <option value="video">Video (MP4/MP3)</option>
                        <option value="pdf">Document (PDF)</option>
                        <option value="scorm">SCORM Package (ZIP)</option>
                    </select>
                    <div class="flex gap-1">
                        <input type="file" required class="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 w-full">
                        <button type="submit" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-semibold">Add</button>
                    </div>
                </form>
            </div>
        </div>
    `).join('');
}

// Global window hooks for inline form/delete actions
window.deleteCourse = async function(courseId) {
    if (confirm('Are you sure you want to delete this course and all its lessons?')) {
        await supabase.from('courses').delete().eq('id', courseId);
        loadDashboardStats();
        fetchAdminCourses();
    }
}

window.handleUploadLesson = async function(e, courseId) {
    e.preventDefault();
    const form = e.target;
    const title = form.querySelector('input[type="text"]').value;
    const lessonType = form.querySelector('select').value;
    const fileInput = form.querySelector('input[type="file"]');
    const file = fileInput.files[0];

    if (!file) return alert('Please select a file to upload.');

    const filePath = `course_${courseId}/${Date.now()}_${file.name}`;
    
    // Upload file to Supabase Storage bucket 'lms-content'
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('lms-content')
        .upload(filePath, file);

    if (uploadError) {
        return alert('Upload failed: ' + uploadError.message);
    }

    // Get public URL of the uploaded file
    const { data: publicUrlData } = supabase.storage
        .from('lms-content')
        .getPublicUrl(filePath);

    // Save lesson record to database
    const { error: dbError } = await supabase.from('lessons').insert([{
        course_id: courseId,
        title: title,
        lesson_type: lessonType,
        content_url: publicUrlData.publicUrl
    }]);

    if (dbError) {
        alert('Error saving lesson record: ' + dbError.message);
    } else {
        form.reset();
        loadDashboardStats();
        fetchAdminCourses();
    }
}
