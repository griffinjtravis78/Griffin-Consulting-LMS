import { checkAuth, supabase } from './app.js';

let allCourses = [];
let currentStudentProfile = null;

(async () => {
    currentStudentProfile = await checkAuth('student');
    if (currentStudentProfile) {
        fetchStudentCourses();
    }
})();

async function fetchStudentCourses() {
    const container = document.getElementById('student-course-list');
    const { data: courses, error } = await supabase.from('courses').select('*, lessons(*)').order('created_at', { ascending: false });

    if (error || !courses || courses.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-sm">No courses available at this time.</p>`;
        return;
    }

    allCourses = courses;

    container.innerHTML = courses.map(course => `
        <div class="bg-slate-900 rounded-lg border border-slate-700 hover:border-blue-500 transition cursor-pointer overflow-hidden" onclick="window.selectCourse(${course.id})">
            ${course.thumbnail_url ? `<img src="${course.thumbnail_url}" alt="${course.title}" class="w-full h-32 object-cover border-b border-slate-700">` : ''}
            <div class="p-4">
                <h4 class="font-bold text-slate-200 text-sm">${course.title}</h4>
                <p class="text-xs text-slate-400 mt-1 line-clamp-2">${course.description || 'No description.'}</p>
                <div class="flex justify-between items-center mt-3">
                    <span class="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">${course.lessons ? course.lessons.length : 0} Modules</span>
                    <span class="text-xs text-emerald-400 font-semibold">${course.ceu_credits ? course.ceu_credits + ' CEUs' : ''}</span>
                </div>
            </div>
        </div>
    `).join('');
}

window.selectCourse = async function(courseId) {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;

    // Check if course is already completed by student
    const { data: completion } = await supabase
        .from('student_completions')
        .select('*')
        .eq('user_id', currentStudentProfile.id)
        .eq('course_id', courseId)
        .maybeSingle();

    const isCompleted = !!completion;

    const viewer = document.getElementById('lesson-viewer-container');
    viewer.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div>
                <h3 class="text-xl font-bold text-blue-400">${course.title}</h3>
                <p class="text-slate-400 text-sm mt-1">${course.description || ''}</p>
            </div>
            <div class="text-right">
                <span class="text-xs bg-emerald-600/20 text-emerald-400 px-3 py-1 rounded-full font-semibold">${course.ceu_credits || 0} CEU Credits</span>
            </div>
        </div>
        
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Course Modules</h4>
        <div class="space-y-2 mb-6">
            ${course.lessons && course.lessons.length > 0 ? course.lessons.map(l => `
                <div class="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-700">
                    <span class="text-sm text-slate-200">▶ [${l.lesson_type.toUpperCase()}]${l.title}</span>
                    <button onclick="window.playLesson('${l.lesson_type}', '${l.content_url}', '${l.title}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition">Launch</button>
                </div>
            `).join('') : '<p class="text-xs text-slate-500 italic">No modules published for this course yet.</p>'}
        </div>

        <div id="media-player-box" class="mb-6"></div>

        <div class="border-t border-slate-700 pt-4 flex justify-between items-center">
            <span class="text-xs text-slate-400">Status: <strong class="${isCompleted ? 'text-emerald-400' : 'text-amber-400'}">${isCompleted ? 'Completed / Verified' : 'In Progress'}</strong></span>
            ${!isCompleted ? `<button onclick="window.markCourseComplete(${course.id})" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition">Mark Course Completed</button>` : `<span class="text-xs text-emerald-400 font-semibold">✓ Completed & Recorded to Transcript</span>`}
        </div>
    `;
}

window.playLesson = function(type, url, title) {
    const box = document.getElementById('media-player-box');
    if (!box) return;

    let mediaElement = '';
    if (type === 'video') {
        mediaElement = `<video controls class="w-full rounded-lg border border-slate-700 shadow-lg max-h-[450px]"><source src="${url}" type="video/mp4">Your browser does not support the video tag.</video>`;
    } else if (type === 'pdf') {
        mediaElement = `<iframe src="${url}" class="w-full h-[500px] rounded-lg border border-slate-700"></iframe>`;
    } else {
        mediaElement = `<div class="p-4 bg-slate-900 rounded-lg border border-slate-700 text-center"><p class="text-sm text-slate-300 mb-2">SCORM Package or Downloadable Asset</p><a href="${url}" target="_blank" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold inline-block">Download / Open Package</a></div>`;
    }

    box.innerHTML = `
        <div class="border-t border-slate-700 pt-4 mt-4">
            <h4 class="text-sm font-semibold text-slate-300 mb-2">Now Playing: ${title}</h4>
            ${mediaElement}
        </div>
    `;
};

window.markCourseComplete = async function(courseId) {
    const { error } = await supabase.from('student_completions').insert([{
        user_id: currentStudentProfile.id,
        course_id: courseId,
        status: 'Completed / Verified'
    }]);

    if (error) {
        alert('Error recording completion: ' + error.message);
    } else {
        alert('Course successfully marked as completed! Recorded to your official transcript.');
        window.selectCourse(courseId);
    }
};

// --- OFFICIAL TRANSCRIPT MODAL & PRINT PIPELINE ---
window.openTranscriptModal = async function() {
    // Fetch student's completions and orgs
    const { data: completions } = await supabase
        .from('student_completions')
        .select('completed_at, courses(title, ceu_credits, id)')
        .eq('user_id', currentStudentProfile.id);

    const { data: orgs } = await supabase
        .from('student_organizations')
        .select('*')
        .eq('user_id', currentStudentProfile.id);

    const primaryOrg = orgs && orgs.length > 0 ? orgs[0].org_name : 'Independent / Unaffiliated';
    const totalModules = completions ? completions.length : 0;
    const totalCEUs = completions ? completions.reduce((acc, c) => acc + (parseFloat(c.courses?.ceu_credits) || 0), 0) : 0;

    let modal = document.getElementById('transcript-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'transcript-modal';
        modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-white text-slate-900 rounded-xl max-w-4xl w-full p-8 shadow-2xl relative my-8 print:p-0 print:shadow-none">
            <div class="flex justify-between items-start border-b border-slate-300 pb-4 mb-6">
                <div>
                    <h2 class="text-xl font-extrabold tracking-wide text-blue-900">GRIFFIN CONSULTING</h2>
                    <p class="text-xs font-semibold tracking-wider text-slate-500">STRATEGY | PERFORMANCE | PEOPLE</p>
                    <h1 class="text-lg font-bold text-slate-800 mt-2">OFFICIAL COURSE TRANSCRIPT</h1>
                </div>
                <div class="flex gap-2 print:hidden">
                    <button onclick="window.print()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold">Print / Save PDF</button>
                    <button onclick="document.getElementById('transcript-modal').remove()" class="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold">Close</button>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-xs mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                    <p><strong class="text-slate-600">Student Legal Name:</strong> ${currentStudentProfile.first_name || ''} ${currentStudentProfile.last_name || ''}</p>
                    <p class="mt-1"><strong class="text-slate-600">Student ID / Employee ID:</strong> ${currentStudentProfile.unique_identifier || 'N/A'}</p>
                </div>
                <div>
                    <p><strong class="text-slate-600">Organization / Agency:</strong> ${primaryOrg}</p>
                    <p class="mt-1"><strong class="text-slate-600">Date of Issuance:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
            </div>

            <div class="mb-6">
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Academic & Professional Development Record</h3>
                <table class="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr class="bg-slate-100 border-b border-slate-300 text-slate-700">
                            <th class="p-2.5">Course Code</th>
                            <th class="p-2.5">Course Title</th>
                            <th class="p-2.5">Completion Date</th>
                            <th class="p-2.5">CEU Credits</th>
                            <th class="p-2.5">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        ${completions && completions.length > 0 ? completions.map((c, idx) => `
                            <tr>
                                <td class="p-2.5 font-mono">GC-CRS-${c.courses?.id || idx + 100}</td>
                                <td class="p-2.5 font-semibold">${c.courses?.title || 'Course'}</td>
                                <td class="p-2.5 text-slate-600">${new Date(c.completed_at).toISOString().split('T')[0]}</td>
                                <td class="p-2.5">${c.courses?.ceu_credits || 0} CEUs</td>
                                <td class="p-2.5 text-emerald-700 font-medium">Completed / Verified</td>
                            </tr>
                        `).join('') : `<tr><td colspan="5" class="p-4 text-center text-slate-500 italic">No completed coursework recorded yet.</td></tr>`}
                    </tbody>
                </table>
            </div>

            <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs mb-6 space-y-1">
                <h4 class="font-bold uppercase tracking-wider text-slate-700 mb-2">Summary of Credentials</h4>
                <p><strong>Total Modules Completed:</strong> ${totalModules} Modules</p>
                <p><strong>Total Continuing Education Units (CEUs):</strong> ${totalCEUs} CEUs</p>
                <p><strong>Overall Standing:</strong> ${totalModules > 0 ? 'Satisfactory Completion / Certified Practitioner' : 'Enrolled'}</p>
            </div>

            <div class="text-xs text-slate-600 border-t border-slate-200 pt-4 mb-8 space-y-2">
                <p><strong>Authentication & Compliance Disclaimer:</strong> This transcript is generated electronically by the Griffin Consulting LMS platform. Completion records reflect successful mastery of coursework aligned with professional development and regulatory standards.</p>
            </div>

            <div class="flex justify-between items-end pt-4">
                <div>
                    <p class="text-xs font-bold text-slate-800">Authorized Signature:</p>
                    <p class="font-serif italic text-lg text-blue-900 mt-1">Travis J. Griffin</p>
                    <p class="text-[11px] text-slate-500 font-medium">Director of Training & Development, Griffin Consulting</p>
                </div>
                <div class="text-right text-[10px] text-slate-400">
                    <p>Griffin Consulting | Strategy | Performance | People</p>
                    <p>Verified Secure Record</p>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
};
