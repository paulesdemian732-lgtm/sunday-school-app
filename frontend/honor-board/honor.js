// اتصال Socket.io اللحظي
const socket = io();

let honorKidsList = [];

function goToSelectUser() {
    window.location.href = '/views/select-user.html';
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

function computeKidScores(kid) {
    let totalScore = 0;
    let liturgyCount = 0;
    let schoolCount = 0;
    let reciteCount = 0;
    let visitationCount = 0;

    if (kid && kid.records) {
        Object.values(kid.records).forEach(rec => {
            if (rec.liturgy) {
                totalScore += 5;
                liturgyCount++;
            }
            if (rec.sundaySchool) {
                totalScore += 5;
                schoolCount++;
            }
            if (rec.recitation) {
                totalScore += 5;
                reciteCount++;
            }
            if (rec.visitation) {
                visitationCount++;
            }
        });
    }

    return { totalScore, liturgyCount, schoolCount, reciteCount, visitationCount };
}

function renderRankings() {
    const container = document.getElementById('ranksList');
    const emptyNotice = document.getElementById('emptyNotice');

    if (!container) return;
    container.innerHTML = '';

    if (honorKidsList.length === 0) {
        if (emptyNotice) emptyNotice.style.display = 'block';
        return;
    }

    if (emptyNotice) emptyNotice.style.display = 'none';

    // ترتيب تنازلي حسب النقاط
    const rankedKids = honorKidsList.map(k => ({
        ...k,
        ...computeKidScores(k)
    })).sort((a, b) => b.totalScore - a.totalScore);

    // حساب المراكز بنظام Dense Ranking
    let currentRank = 0;
    let lastScore = null;

    rankedKids.forEach((kid) => {
        if (kid.totalScore !== lastScore) {
            currentRank++;
            lastScore = kid.totalScore;
        }

        const rank = currentRank;
        let rankClass = '';
        let rankIconOrNum = rank;

        if (rank === 1) {
            rankClass = 'rank-1';
            rankIconOrNum = '<i class="fa-solid fa-trophy" style="color: #f59e0b;"></i>';
        } else if (rank === 2) {
            rankClass = 'rank-2';
            rankIconOrNum = '<i class="fa-solid fa-medal" style="color: #64748b;"></i>';
        } else if (rank === 3) {
            rankClass = 'rank-3';
            rankIconOrNum = '<i class="fa-solid fa-award" style="color: #b45309;"></i>';
        }

        const avatarHtml = kid.photo
            ? `<img src="${kid.photo}" alt="${escapeHtml(kid.name)}" class="honor-kid-avatar-img">`
            : `<div class="honor-kid-avatar-default">
                    <i class="fa-solid fa-child"></i>
               </div>`;

        const card = document.createElement('div');
        card.className = `rank-card ${rankClass}`;
        card.innerHTML = `
            <div class="rank-card-main">
                <div class="rank-badge-box">
                    ${rankIconOrNum}
                </div>
                ${avatarHtml}
                <div class="kid-center-info">
                    <div class="kid-name-servant">
                        <h4>${escapeHtml(kid.name)}</h4>
                        <span>(الخادم المسؤول: ${escapeHtml(kid.servant || 'غير محدد')})</span>
                    </div>
                    <div class="kid-stats-grid">
                        <span class="stat-tag"><i class="fa-solid fa-church"></i> قداس: <strong>${kid.liturgyCount}</strong></span>
                        <span class="stat-tag"><i class="fa-solid fa-book-bible"></i> مدارس: <strong>${kid.schoolCount}</strong></span>
                        <span class="stat-tag"><i class="fa-solid fa-lightbulb"></i> آيات: <strong>${kid.reciteCount}</strong></span>
                        <span class="stat-tag stat-tag-visitation"><i class="fa-solid fa-phone-volume"></i> افتقاد: <strong>${kid.visitationCount}</strong></span>
                    </div>
                </div>
            </div>

            <div class="points-side-box">
                <span class="pts-num">${kid.totalScore}</span>
                <span class="pts-lbl">نقطة</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// جلب الأطفال وتحديث الترتيب
async function fetchHonorData() {
    try {
        const res = await fetch('/api/children');
        if (res.ok) {
            honorKidsList = await res.json();
            renderRankings();
        }
    } catch (err) {
        console.error('فشل في جلب بيانات لوحة الشرف:', err);
    }
}

// المزامنة اللحظية مع التعديلات
socket.on('childAdded', fetchHonorData);
socket.on('childDeleted', fetchHonorData);
socket.on('childUpdated', fetchHonorData);
socket.on('recordUpdated', fetchHonorData);

document.addEventListener('DOMContentLoaded', fetchHonorData);