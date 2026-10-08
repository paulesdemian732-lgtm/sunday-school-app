// اتصال Socket.io اللحظي
const socket = io();

let globalKidsData = [];

function getGlobalWeeks() {
    try {
        return JSON.parse(localStorage.getItem('sundaySchoolWeeks') || '[]');
    } catch (e) {
        return [];
    }
}

function goToSelectUser() {
    window.location.href = '/views/select-user.html';
}

function hideProfileModal() {
    const modal = document.getElementById('kidProfileModal');
    if (modal) modal.style.display = 'none';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function calculateKidTotalScore(kid) {
    if (!kid || !kid.records) return 0;
    let total = 0;
    Object.values(kid.records).forEach(rec => {
        if (!rec) return;
        if (rec.liturgy) total += 5;
        if (rec.sundaySchool) total += 5;
        if (rec.recitation) total += 5;
    });
    return total;
}

function calculateAttendanceStats(kid, totalWeeksCount) {
    let liturgyPresent = 0;
    let schoolPresent = 0;
    let reciteDone = 0;
    let visitedCount = 0;

    if (kid && kid.records) {
        Object.values(kid.records).forEach(rec => {
            if (!rec) return;
            if (rec.liturgy) liturgyPresent++;
            if (rec.sundaySchool) schoolPresent++;
            if (rec.recitation) reciteDone++;
            if (rec.visitation) visitedCount++;
        });
    }

    const safeTotalWeeks = Math.max(0, Number(totalWeeksCount) || 0);
    const liturgyAbsent = Math.max(0, safeTotalWeeks - liturgyPresent);
    const schoolAbsent = Math.max(0, safeTotalWeeks - schoolPresent);
    const reciteMissed = Math.max(0, safeTotalWeeks - reciteDone);

    return {
        liturgyPresent,
        liturgyAbsent,
        schoolPresent,
        schoolAbsent,
        reciteDone,
        reciteMissed,
        visitedCount
    };
}

function renderKidsList(filteredKids) {
    const container = document.getElementById('allKidsContainer');
    const emptyNotice = document.getElementById('emptyNotice');
    const countBadge = document.getElementById('renderedKidsCount');

    if (!container) return;
    const safeList = Array.isArray(filteredKids) ? filteredKids : [];
    if (countBadge) countBadge.textContent = `${safeList.length} طفل`;
    container.innerHTML = '';

    if (safeList.length === 0) {
        if (emptyNotice) emptyNotice.style.display = 'block';
        return;
    }

    if (emptyNotice) emptyNotice.style.display = 'none';

    safeList.forEach(kid => {
        const totalPts = calculateKidTotalScore(kid);
        const card = document.createElement('div');
        card.className = 'kid-stat-row-card';
        card.onclick = () => openKidProfile(kid._id);

        const avatarHtml = kid.photo
            ? `<img src="${kid.photo}" alt="${escapeHtml(kid.name)}" class="ksr-avatar-img">`
            : `<div class="ksr-avatar">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
               </div>`;
        
        card.innerHTML = `
            <div class="ksr-info">
                ${avatarHtml}
                <div class="ksr-details">
                    <h4>${escapeHtml(kid.name)}</h4>
                    <p>الخادم: ${escapeHtml(kid.servant || 'غير محدد')}</p>
                </div>
            </div>
            <div class="ksr-score-wrap">
                <div class="ksr-pts-box">
                    <span class="ksr-pts-num">${totalPts}</span>
                    <span class="ksr-pts-lbl">نقطة</span>
                </div>
                <span class="ksr-arrow">◀</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function handleSearch(query) {
    const cleanQuery = (query || '').trim().toLowerCase();
    const filtered = globalKidsData.filter(k => (k.name || '').toLowerCase().includes(cleanQuery));
    renderKidsList(filtered);
}

function openKidProfile(kidId) {
    const allWeeks = getGlobalWeeks();
    const kid = globalKidsData.find(k => k._id === kidId);
    if (!kid) return;

    const servantWeeks = allWeeks.filter(w => w.servant === kid.servant);

    const avatarContainer = document.getElementById('profBigAvatarWrap');
    if (avatarContainer) {
        if (kid.photo) {
            avatarContainer.innerHTML = `<img src="${kid.photo}" alt="${escapeHtml(kid.name)}" class="profile-big-avatar-img">`;
        } else {
            avatarContainer.innerHTML = `
                <div class="profile-big-avatar">
                    <svg viewBox="0 0 40 40" width="30" height="30" fill="#ffffff">
                        <circle cx="20" cy="13" r="6"/>
                        <path d="M9 33 C9 24 14 21 20 21 C26 21 31 24 31 33 Z"/>
                    </svg>
                </div>`;
        }
    }

    document.getElementById('profKidName').textContent = kid.name || 'بدون اسم';
    document.getElementById('profKidServant').textContent = `الخادم: ${kid.servant || 'غير محدد'}`;
    
    const phoneEl = document.getElementById('profKidPhone');
    if (kid.phone) {
        phoneEl.href = `tel:${kid.phone}`;
        phoneEl.innerHTML = `<span>📞</span> <span>${escapeHtml(kid.phone)}</span>`;
        phoneEl.style.display = 'inline-flex';
    } else {
        phoneEl.style.display = 'none';
    }

    const totalPts = calculateKidTotalScore(kid);
    document.getElementById('profTotalPoints').textContent = totalPts;

    const rankBadge = document.getElementById('profRankBadge');
    if (totalPts >= 60) {
        rankBadge.innerHTML = `<span>🥇 بطل متميز</span>`;
    } else if (totalPts >= 30) {
        rankBadge.innerHTML = `<span>🥈 تلميذ مجتهد</span>`;
    } else {
        rankBadge.innerHTML = `<span>⭐ نجم واعد</span>`;
    }

    const stats = calculateAttendanceStats(kid, servantWeeks.length);
    document.getElementById('countLiturgyPresent').textContent = stats.liturgyPresent;
    document.getElementById('countLiturgyAbsent').textContent = stats.liturgyAbsent;
    document.getElementById('countSchoolPresent').textContent = stats.schoolPresent;
    document.getElementById('countSchoolAbsent').textContent = stats.schoolAbsent;
    document.getElementById('countReciteDone').textContent = stats.reciteDone;
    document.getElementById('countReciteMissed').textContent = stats.reciteMissed;
    document.getElementById('countVisited').textContent = stats.visitedCount;

    const tableBody = document.getElementById('profWeeksTableBody');
    tableBody.innerHTML = '';

    if (servantWeeks.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="color: #94a3b8; padding: 12px;">لا توجد أسابيع مسجلة بعد</td></tr>`;
    } else {
        servantWeeks.forEach(w => {
            const rec = (kid.records && kid.records[w.id]) ? kid.records[w.id] : {
                liturgy: false, sundaySchool: false, recitation: false, visitation: false
            };

            let pts = 0;
            if (rec.liturgy) pts += 5;
            if (rec.sundaySchool) pts += 5;
            if (rec.recitation) pts += 5;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(w.date)}</strong></td>
                <td>${rec.liturgy ? '<span class="check-green">✔</span>' : '<span class="cross-gray">✘</span>'}</td>
                <td>${rec.sundaySchool ? '<span class="check-green">✔</span>' : '<span class="cross-gray">✘</span>'}</td>
                <td>${rec.recitation ? '<span class="check-green">✔</span>' : '<span class="cross-gray">✘</span>'}</td>
                <td>${rec.visitation ? '<span class="check-green">✔</span>' : '<span class="cross-gray">✘</span>'}</td>
                <td style="font-weight: 900; color: #08111e;">+${pts}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    const notesBox = document.getElementById('profNotesListBox');
    notesBox.innerHTML = '';

    if (!kid.notes || kid.notes.length === 0) {
        notesBox.innerHTML = `<div class="empty-notes-tag">لا توجد ملاحظات مسجلة لهذا الطفل بعد.</div>`;
    } else {
        kid.notes.forEach(note => {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'note-single-item';
            noteDiv.innerHTML = `
                <div class="note-item-meta">
                    <span>📅 ${escapeHtml(note.date)}</span>
                    <span>الخادم: ${escapeHtml(note.servant || kid.servant)}</span>
                </div>
                <div class="note-item-text">${escapeHtml(note.text)}</div>
            `;
            notesBox.appendChild(noteDiv);
        });
    }

    const modal = document.getElementById('kidProfileModal');
    if (modal) modal.style.display = 'flex';
}

window.addEventListener('click', (e) => {
    const modal = document.getElementById('kidProfileModal');
    if (e.target === modal) {
        hideProfileModal();
    }
});

// جلب البيانات من السيرفر السحابي
async function loadKidsData() {
    try {
        const res = await fetch('/api/children');
        if (res.ok) {
            globalKidsData = await res.json();
            const totalEl = document.getElementById('totalAllKids');
            if (totalEl) totalEl.textContent = globalKidsData.length;
            renderKidsList(globalKidsData);
        }
    } catch (err) {
        console.error('فشل في جلب البيانات:', err);
    }
}

// الاستماع للتحديثات اللحظية
socket.on('childAdded', loadKidsData);
socket.on('childDeleted', loadKidsData);
socket.on('childUpdated', loadKidsData);
socket.on('recordUpdated', loadKidsData);
socket.on('noteAdded', loadKidsData);

document.addEventListener('DOMContentLoaded', loadKidsData);