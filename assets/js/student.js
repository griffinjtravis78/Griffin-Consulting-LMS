import { checkAuth, supabase } from './app.js';

let allCourses = [];

(async () => {
    const user = await checkAuth('student');
    if (user) {
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
        <div class="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-blue-500 transition cursor-pointer" onclick="window.selectCourse(${course.id})">
            <h4 class="font-bold text-slate-200 text-sm">${course.title}</h4>
            <p class="text-xs text-slate-400 mt-1 line-clamp-2">${course.description || 'No description.'}</p>
            <span class="inline-block mt-3 text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">${course.lessons ? course.lessons.length : 0} Modules</span>
        </div>
    `).join('');
}

window.selectCourse = function(courseId) {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;

    const viewer = document.getElementById('lesson-viewer-container');
    viewer.innerHTML = `
        <h3 class="text-xl font-bold text-blue-400 mb-1">${course.title}</h3>
        <p class="text-slate-400 text-sm mb-6">${course.description || ''}</p>
        
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Course Modules</h4>
        <div class="space-y-2">
            ${course.lessons && course.lessons.length > 0 ? course.lessons.map(l => `
                <div class="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-700">
                    <span class="text-sm text-slate-200">▶ [${l.lesson_type.toUpperCase()}]${l.title}</span>
                    <button onclick="window.playLesson('${l.lesson_type}', '${l.content_url}', '${l.title}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition">Launch</button>
                </div>
            `).join('') : '<p class="text-xs text-slate-500 italic">No modules published for this course yet.</p>'}
        </div>
        <div id="media-player-box" class="mt-6"></div>
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
}
