import { checkAuth, supabase } from './app.js';

let complianceRecords = [];

// Tab Navigation (Defined globally right away)
window.switchAdminTab = function(tabName) {
    document.getElementById('admin-tab-courses').classList.add('hidden');
    document.getElementById('admin-tab-students').classList.add('hidden');
    document.getElementById('admin-tab-reports').classList.add('hidden');

    document.getElementById('tab-btn-courses').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    document.getElementById('tab-btn-students').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';
    document.getElementById('tab-btn-reports').className = 'px-3 py-1.5 text-xs font-semibold rounded text-slate-300 hover:text-white transition';

    document.getElementById(`admin-tab-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-btn-${tabName}`).className = 'px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white transition';
};

// Verify admin authentication on load
(async () => {
    const user = await checkAuth('admin');
    if (user) {
        loadDashboardStats();
        fetchAdminCourses();
        fetchComplianceReports();
    }
})();

// Load Dashboard Metrics
async function loadDashboardStats() {
    try {
        const { count: courseCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
        const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
        const { count: lessonCount } = await supabase.from('lessons').select('*', { count: 'exact', head: true });

        document.getElementById('stat-total-courses').textContent = courseCount || 0;
        document.getElementById('stat-total-students').textContent = studentCount || 0;
        document.getElementById('stat-total-modules').textContent = lessonCount || 0;
    } catch (err) {
        console.error('Error loading dashboard stats:', err);
    }
}

// Fetch and Render Courses in Admin Portal
async function fetchAdminCourses() {
    const container = document.getElementById('admin-course-list');
    try {
        const { data: courses, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = `<p class="text-red-400 text-sm italic">Error loading courses: ${error.message}</p>`;
            return;
        }

        if (!courses || courses.length === 0) {
            container.innerHTML = `<p class="text-slate-400 text-sm italic">No courses created yet. Use the form to add your first course.</p>`;
            return;
        }

        const { data: allLessons } = await supabase.from('lessons').select('*');

        container.innerHTML = courses.map(course => {
            const courseLessons = allLessons ? allLessons.filter(l => l.course_id === course.id) : [];
            return `
                <div class="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-4">
                    <div class="flex justify-between items-start flex-wrap gap-4">
                        <div class="flex gap-4 items-center">
                            ${course.thumbnail_url ? `<img src="${course.thumbnail_url}" alt="${course.title}" class="w-16 h-16 rounded-lg object-cover border border-slate-700">` : ''}
                            <div>
                                <h3 class="font-bold text-slate-100 text-base">${course.title}</h3>
                                <p class="text-xs text-slate-400 mt-0.5">${course.description || 'No description provided.'}</p>
                                <div class="flex gap-3 mt-2">
                                    <span class="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">${course.ceu_credits || 0} CEU Credits</span>
                                    <span class="text-xs text-slate-400">${courseLessons.length} Lessons</span>
                                </div>
                            </div>
                        </div>
                        <button onclick="window.deleteCourse(${course.id})" class="px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded text-xs font-semibold transition">Delete Course</button>
                    </div>

                    <!-- Lessons Section -->
                    <div class="border-t border-slate-800 pt-3">
                        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Published Lessons</h4>
                        <div class="space-y-2">
                            ${courseLessons.length > 0 ? courseLessons.map(l => `
                                <div class="flex justify-between items-center bg-slate-800 p-2.5 rounded-lg border border-slate-700 text-xs">
                                    <span class="text-slate-200">📄 [${l.lesson_type.toUpperCase()}] ${l.title}</span>
                                    <div class="flex gap-3">
                                        <a href="${l.content_url}" target="_blank" class="text-blue-400 hover:underline">View Asset</a>
                                        <button onclick="window.deleteLesson(${l.id})" class="text-red-400 hover:underline">Remove</button>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-xs text-slate-500 italic">No lessons added to this course yet.</p>'}
                        </div>

                        <!-- Add Lesson Inline Form (Netlify URL Workflow) -->
                        <form onsubmit="window.handleUploadLesson(event, ${course.id})" class="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input type="text" id="lesson-title-${course.id}" placeholder="Lesson Title" required class="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                            <select id="lesson-type-${course.id}" class="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                                <option value="scorm">SCORM / HTML5 (Netlify URL)</option>
                                <option value="video">Video (MP4 URL)</option>
                                <option value="pdf">PDF Document (URL)</option>
                            </select>
                            <input type="text" id="lesson-url-${course.id}" placeholder="Paste Netlify URL (https://...)" required class="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100">
                            <button type="submit" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition">Add Module</button>
                        </form>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Exception in fetchAdminCourses:', err);
        container.innerHTML = `<p class="text-red-400 text-sm italic">Error: ${err.message}</p>`;
    }
}

// Create Course Form Handler
document.getElementById('create-course-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('course-title').value;
    const description = document.getElementById('course-desc').value;
    const ceu_credits = parseFloat(document.getElementById('course-ceu').value) || 0;
    const thumbInput = document.getElementById('course-thumbnail');
    const thumbFile = thumbInput.files[0];

    let thumbnail_url = null;
    if (thumbFile) {
        const thumbPath = `thumbnails/${Date.now()}_${thumbFile.name}`;
        const { error: uploadErr } = await supabase.storage.from('lms-content').upload(thumbPath, thumbFile);
        if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('lms-content').getPublicUrl(thumbPath);
            thumbnail_url = urlData.publicUrl;
        }
    }

    const { error } = await supabase.from('courses').insert([{ title, description, ceu_credits, thumbnail_url }]);
    if (error) {
        alert('Error creating course: ' + error.message);
    } else {
        document.getElementById('create-course-form').reset();
        loadDashboardStats();
        fetchAdminCourses();
    }
});

window.deleteCourse = async function(courseId) {
    if (!confirm('Are you sure you want to delete this course and all its modules?')) return;
    const { error } = await supabase.from('courses').delete().eq('id', courseId);
    if (error) {
        alert('Error deleting course: ' + error.message);
    } else {
        loadDashboardStats();
        fetchAdminCourses();
    }
};

window.handleUploadLesson = async function(e, courseId) {
    e.preventDefault();
    const title = document.getElementById(`lesson-title-${courseId}`).value;
    const lesson_type = document.getElementById(`lesson-type-${courseId}`).value;
    const urlInput = document.getElementById(`lesson-url-${courseId}`);
    const content_url = urlInput.value.trim();

    if (!content_url) {
        alert('Please provide a valid content URL.');
        return;
    }

    const { error: dbError } = await supabase.from('lessons').insert([
        {
            course_id: courseId,
            title: title,
            lesson_type: lesson_type,
            content_url: content_url
        }
    ]);

    if (dbError) {
        alert('Error saving lesson record: ' + dbError.message);
    } else {
        loadDashboardStats();
        fetchAdminCourses();
    }
};

window.deleteLesson = async function(lessonId) {
    if (!confirm('Remove this lesson module?')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
    if (error) alert('Error removing lesson: ' + error.message);
    else { loadDashboardStats(); fetchAdminCourses(); }
};

// --- STUDENT PROVISIONING LOGIC ---
window.addAgentRow = function() {
    const container = document.getElementById('agent-rows-container');
    const row = document.createElement('div');
    row.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900 p-3 rounded-lg border border-slate-700 agent-row relative';
    row.innerHTML = `
        <div>
            <label class="block text-xs font-medium text-slate-400 mb-1">Agent ID</label>
            <input type="text" required class="agent-id-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" placeholder="e.g., AG-88492">
        </div>
        <div class="flex gap-2 items-end">
            <div class="flex-grow">
                <label class="block text-xs font-medium text-slate-400 mb-1">Agent State</label>
                <input type="text" required class="agent-state-input w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100" placeholder="e.g., MO">
            </div>
            <button type="button" onclick="this.closest('.agent-row').remove()" class="px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded text-xs transition">Remove</button>
        </div>
    `;
    container.appendChild(row);
};

window.addOrgRow = function() {
    const container = document.getElementById('org-rows-container');
    const row = document.createElement('div');
    row.className = 'bg-slate-900 p-4 rounded-lg border border-slate-700 org-row space-y-3 relative';
    row.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Additional Organization</span>
            <button type="button" onclick="this.closest('.org-row').remove()" class="px-2.5 py-1 bg-red-600/
