// فحص الأمان واختيار الخادم
const currentServant = sessionStorage.getItem('currentServant');
if (!currentServant) {
    window.location.href = '/views/select-user.html';
}

const servantNameEl = document.getElementById('currentServantName');
if (servantNameEl) {
    servantNameEl.textContent = currentServant;
}

// اتصال Socket.io اللحظي
const socket = io();

let globalKids = [];
let globalWeeks = [];
let activeWeekId = null;

let currentCropper = null;
let croppedImageBase64 = null;
let currentTargetPhotoType = null;

// ==========================================
// استرجاع ومزامنة البيانات من MongoDB عبر API
// ==========================================
async function fetchKidsFromDB() {
    try {
        const res = await fetch('/api/children');
        if (res.ok) {
            globalKids = await res.json();
            renderClassKids();
        }
    } catch (err) {
        console.error('فشل جلب الأطفال من السيرفر:', err);
    }
}

async function fetchWeeksFromDB() {
    try {
        const res = await fetch('/api/weeks');
        if (res.ok) {
            globalWeeks = await res.json();
            populateWeeksDropdown();
            renderClassKids();
        }
    } catch (err) {
        console.error('فشل جلب الأسابيع من السيرفر:', err);
    }
}

// التحديث اللحظي الفوري عبر Socket.io
socket.on('childAdded', (newKid) => {
    const exists = globalKids.some(k => k._id === newKid._id);
    if (!exists) {
        globalKids.push(newKid);
        renderClassKids();
    }
});

socket.on('weekAdded', (newWeek) => {
    const exists = globalWeeks.some(w => w.id === newWeek.id);
    if (!exists) {
        globalWeeks.unshift(newWeek);
        populateWeeksDropdown();
        renderClassKids();
    }
});

socket.on('weekDeleted', (deletedWeekId) => {
    globalWeeks = globalWeeks.filter(w => w.id !== deletedWeekId);
    if (activeWeekId === deletedWeekId) {
        activeWeekId = null;
    }
    populateWeeksDropdown();
    fetchKidsFromDB();
});

socket.on('recordUpdated', ({ id, weekKey, data }) => {
    const kid = globalKids.find(k => k._id === id);
    if (kid) {
        if (!kid.records) kid.records = {};
        kid.records[weekKey] = data;
        renderClassKids();
    }
});

socket.on('childDeleted', (deletedId) => {
    globalKids = globalKids.filter(k => k._id !== deletedId);
    renderClassKids();
});

socket.on('childUpdated', (updatedKid) => {
    const index = globalKids.findIndex(k => k._id === updatedKid._id);
    if (index !== -1) {
        globalKids[index] = updatedKid;
        renderClassKids();
    }
});

socket.on('noteAdded', ({ id, note }) => {
    const kid = globalKids.find(k => k._id === id);
    if (kid) {
        if (!kid.notes) kid.notes = [];
        kid.notes.unshift(note);
    }
});

// ==========================================
// إدارة الأسابيع السحابية
// ==========================================
function getServantWeeks() {
    return globalWeeks.filter(w => w.servant === currentServant);
}

function populateWeeksDropdown() {
    const servantWeeks = getServantWeeks();
    const dropdown = document.getElementById('weekDropdown');
    dropdown.innerHTML = '';

    if (servantWeeks.length === 0) {
        dropdown.innerHTML = '<option value="">لا يوجد أسابيع</option>';
        activeWeekId = null;
        return;
    }

    if (!activeWeekId || !servantWeeks.some(w => w.id === activeWeekId)) {
        activeWeekId = servantWeeks[0].id;
    }

    servantWeeks.forEach(w => {
        const option = document.createElement('option');
        option.value = w.id;
        option.textContent = `${w.date} - ${w.label}`;
        if (w.id === activeWeekId) option.selected = true;
        dropdown.appendChild(option);
    });
}

function handleWeekChange(weekId) {
    activeWeekId = weekId;
    renderClassKids();
}

function showAddWeekModal() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const distanceToFriday = (5 - dayOfWeek + 7) % 7;
    const fridayDate = new Date(today);
    fridayDate.setDate(today.getDate() + distanceToFriday);

    document.getElementById('inputWeekDate').value = fridayDate.toISOString().split('T')[0];
    document.getElementById('addWeekModal').style.display = 'flex';
}

function hideAddWeekModal() {
    document.getElementById('addWeekModal').style.display = 'none';
    document.getElementById('weekCreateForm').reset();
}

async function handleCreateWeek(e) {
    e.preventDefault();
    const dateVal = document.getElementById('inputWeekDate').value;
    const labelVal = document.getElementById('inputWeekLabel').value.trim();

    const newWeek = {
        id: 'week_' + Date.now(),
        date: dateVal,
        label: labelVal || `جمعة ${dateVal}`,
        servant: currentServant,
        createdAt: Date.now()
    };

    try {
        const res = await fetch('/api/weeks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newWeek)
        });

        if (res.ok) {
            hideAddWeekModal();
            await fetchWeeksFromDB();
        } else {
            alert('حدث خطأ أثناء حفظ الأسبوع في السيرفر.');
        }
    } catch (err) {
        console.error('فشل حفظ الأسبوع:', err);
    }
}

// دالة حذف الأسبوع المختار حالياً
async function confirmDeleteCurrentWeek() {
    const servantWeeks = getServantWeeks();
    if (servantWeeks.length === 0 || !activeWeekId) {
        alert('لا يوجد أسبوع محدد لحذفه.');
        return;
    }

    const currentWeekObj = servantWeeks.find(w => w.id === activeWeekId);
    const weekName = currentWeekObj ? `${currentWeekObj.date} (${currentWeekObj.label})` : 'هذا الأسبوع';

    const isConfirmed = confirm(`هل أنت متأكد من حذف ${weekName} نهائياً؟\nسيتم مسح درجات هذا الأسبوع لجميع الأطفال.`);
    if (!isConfirmed) return;

    try {
        const res = await fetch(`/api/weeks/${activeWeekId}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert('تم حذف الأسبوع بنجاح.');
            await fetchWeeksFromDB();
            await fetchKidsFromDB();
        } else {
            alert('فشل في حذف الأسبوع من السيرفر.');
        }
    } catch (err) {
        console.error('فشل حذف الأسبوع:', err);
        alert('حدث خطأ أثناء الاتصال بالسيرفر لحذف الأسبوع.');
    }
}

// ==========================================
// إضافة وتعديل وحذف الأطفال
// ==========================================
function showAddKidModal() {
    croppedImageBase64 = null;
    document.getElementById('addKidModal').style.display = 'flex';
    document.getElementById('inputKidName').focus();
}

function hideAddKidModal() {
    document.getElementById('addKidModal').style.display = 'none';
    document.getElementById('kidCreateForm').reset();
    const photoInput = document.getElementById('inputKidPhoto');
    if (photoInput) photoInput.value = '';
    croppedImageBase64 = null;
}

async function handleCreateKid(e) {
    e.preventDefault();
    const name = document.getElementById('inputKidName').value.trim();
    const phone = document.getElementById('inputKidPhone').value.trim();
    const birthdate = document.getElementById('inputKidBirthdate').value;
    const finalPhoto = (currentTargetPhotoType === 'create' && croppedImageBase64) ? croppedImageBase64 : '';

    const newKidPayload = {
        name,
        phone,
        birthdate,
        photo: finalPhoto,
        servant: currentServant,
        records: {},
        notes: []
    };

    try {
        const res = await fetch('/api/children', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newKidPayload)
        });

        if (res.ok) {
            hideAddKidModal();
            fetchKidsFromDB();
        } else {
            alert('حدث خطأ أثناء حفظ الطفل في السيرفر.');
        }
    } catch (err) {
        console.error('فشل في إضافة الطفل:', err);
    }
}

function showEditKidModal(targetKidId = null) {
    const servantKids = globalKids.filter(k => (k.servant || currentServant) === currentServant);
    const select = document.getElementById('selectEditKid');

    if (servantKids.length === 0) {
        alert('لا يوجد أطفال مسجلين في فصلك لتعديل بياناتهم.');
        return;
    }

    croppedImageBase64 = null;
    select.innerHTML = '';
    servantKids.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k._id;
        opt.textContent = k.name;
        select.appendChild(opt);
    });

    const kidToEdit = targetKidId ? targetKidId : servantKids[0]._id;
    select.value = kidToEdit;
    loadKidDataForEdit(kidToEdit);

    document.getElementById('editKidModal').style.display = 'flex';
}

function hideEditKidModal() {
    document.getElementById('editKidModal').style.display = 'none';
    document.getElementById('kidEditForm').reset();
    const photoInput = document.getElementById('editKidPhoto');
    if (photoInput) photoInput.value = '';
    croppedImageBase64 = null;
}

function loadKidDataForEdit(kidId) {
    const kid = globalKids.find(k => k._id === kidId);
    if (!kid) return;

    document.getElementById('editKidId').value = kid._id;
    document.getElementById('editKidName').value = kid.name || '';
    document.getElementById('editKidPhone').value = kid.phone || '';
    document.getElementById('editKidBirthdate').value = kid.birthdate || '';
}

async function handleSaveEditedKid(e) {
    e.preventDefault();
    const kidId = document.getElementById('editKidId').value;
    const name = document.getElementById('editKidName').value.trim();
    const phone = document.getElementById('editKidPhone').value.trim();
    const birthdate = document.getElementById('editKidBirthdate').value;

    const kid = globalKids.find(k => k._id === kidId);
    if (!kid) return;

    const updatedPhoto = (currentTargetPhotoType === 'edit' && croppedImageBase64) ? croppedImageBase64 : kid.photo;

    try {
        const res = await fetch(`/api/children/${kidId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, birthdate, photo: updatedPhoto })
        });

        if (res.ok) {
            hideEditKidModal();
            fetchKidsFromDB();
            alert('تم حفظ التعديلات بنجاح!');
        }
    } catch (err) {
        console.error('فشل تعديل الطفل:', err);
    }
}

async function confirmDeleteCurrentKid() {
    const kidId = document.getElementById('editKidId').value;
    const kid = globalKids.find(k => k._id === kidId);

    if (!kid) {
        alert('يرجى اختيار طفل للحذف.');
        return;
    }

    const userInput = prompt(`⚠️ تحذير أمان هام:\nسيتم مسح سجلات ونقاط الطفل (${kid.name}) بالكامل طوال العام!\n\nلتأكيد الحذف النهائي، اكتب اسم الطفل "${kid.name}" هنا:`);

    if (userInput && userInput.trim() === kid.name.trim()) {
        try {
            const res = await fetch(`/api/children/${kidId}`, { method: 'DELETE' });
            if (res.ok) {
                hideEditKidModal();
                fetchKidsFromDB();
                alert(`تم حذف الطفل (${kid.name}) بنجاح.`);
            }
        } catch (err) {
            console.error('فشل حذف الطفل:', err);
        }
    } else if (userInput !== null) {
        alert('لم يتم الحذف: الاسم غير مطابق.');
    }
}

// ==========================================
// الملاحظات
// ==========================================
function showAddNoteModal() {
    const servantKids = globalKids.filter(k => (k.servant || currentServant) === currentServant);
    const select = document.getElementById('selectNoteKid');
    select.innerHTML = '';

    if (servantKids.length === 0) {
        alert('يرجى إضافة أطفال للفصل أولاً لكتابة ملاحظة.');
        return;
    }

    servantKids.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k._id;
        opt.textContent = k.name;
        select.appendChild(opt);
    });

    document.getElementById('addNoteModal').style.display = 'flex';
}

function hideAddNoteModal() {
    document.getElementById('addNoteModal').style.display = 'none';
    document.getElementById('noteCreateForm').reset();
}

async function handleCreateNote(e) {
    e.preventDefault();
    const kidId = document.getElementById('selectNoteKid').value;
    const noteText = document.getElementById('inputNoteText').value.trim();

    const weeks = getServantWeeks();
    const currentWeek = weeks.find(w => w.id === activeWeekId);
    const weekDate = currentWeek ? currentWeek.date : new Date().toLocaleDateString('ar-EG');

    const notePayload = {
        id: 'note_' + Date.now(),
        date: weekDate,
        text: noteText,
        servant: currentServant
    };

    try {
        const res = await fetch(`/api/children/${kidId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notePayload)
        });

        if (res.ok) {
            hideAddNoteModal();
            fetchKidsFromDB();
            alert('تم حفظ الملاحظة بنجاح!');
        }
    } catch (err) {
        console.error('فشل إضافة الملاحظة:', err);
    }
}

// ==========================================
// تبديل النقاط والربط المباشر
// ==========================================
async function toggleKidPoint(kidId, pointType) {
    if (!activeWeekId) return;

    const kid = globalKids.find(k => k._id === kidId);
    if (!kid) return;

    if (!kid.records) kid.records = {};
    if (!kid.records[activeWeekId]) {
        kid.records[activeWeekId] = {
            liturgy: false,
            sundaySchool: false,
            recitation: false,
            visitation: false
        };
    }

    kid.records[activeWeekId][pointType] = !kid.records[activeWeekId][pointType];
    renderClassKids();

    try {
        await fetch(`/api/children/${kidId}/record`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                weekKey: activeWeekId,
                data: kid.records[activeWeekId]
            })
        });
    } catch (err) {
        console.error('فشل إرسال النقطة للسيرفر:', err);
    }
}

function calculateWeekPoints(weekRecord) {
    if (!weekRecord) return 0;
    let sum = 0;
    if (weekRecord.liturgy) sum += 5;
    if (weekRecord.sundaySchool) sum += 5;
    if (weekRecord.recitation) sum += 5;
    return sum;
}

// ==========================================
// رسم واجهة الأطفال
// ==========================================
function renderClassKids() {
    const servantKids = globalKids.filter(k => (k.servant || currentServant) === currentServant);
    const servantWeeks = getServantWeeks();

    const container = document.getElementById('kidsContainer');
    const emptyNotice = document.getElementById('emptyNotice');
    const emptyTitle = document.getElementById('emptyNoticeTitle');
    const emptySub = document.getElementById('emptyNoticeSub');

    document.getElementById('totalKidsNum').textContent = servantKids.length;
    container.innerHTML = '';

    if (servantWeeks.length === 0) {
        emptyNotice.style.display = 'block';
        emptyTitle.textContent = 'لا توجد أسابيع مسجلة في فصلك بعد.';
        emptySub.textContent = 'اضغط على "أسبوع جديد" لإضافة أول أسبوع وتاريخ.';
        document.getElementById('totalPointsToday').textContent = 0;
        document.getElementById('attendedTodayNum').textContent = 0;
        return;
    }

    if (servantKids.length === 0) {
        emptyNotice.style.display = 'block';
        emptyTitle.textContent = 'لا يوجد أطفال مسجلين في فصلك.';
        emptySub.textContent = 'اضغط على زر "طفل جديد" بالأعلى لإضافة المخدومين.';
        document.getElementById('totalPointsToday').textContent = 0;
        document.getElementById('attendedTodayNum').textContent = 0;
        return;
    }

    emptyNotice.style.display = 'none';

    let weekTotalPoints = 0;
    let weekAttendedCount = 0;

    servantKids.forEach(kid => {
        const record = (kid.records && kid.records[activeWeekId]) ? kid.records[activeWeekId] : {
            liturgy: false,
            sundaySchool: false,
            recitation: false,
            visitation: false
        };

        const kidPoints = calculateWeekPoints(record);
        weekTotalPoints += kidPoints;
        if (record.sundaySchool) weekAttendedCount++;

        const phoneHtml = kid.phone ? `
            <a href="tel:${kid.phone}" onclick="event.stopPropagation()">
                <i class="fa-solid fa-phone"></i>
                <span>${kid.phone}</span>
            </a>
        ` : '';

        const birthdateHtml = kid.birthdate ? `
            <div class="kid-birth-tag">
                <i class="fa-solid fa-cake-candles"></i>
                <span>${kid.birthdate}</span>
            </div>
        ` : '';

        const avatarHtml = kid.photo ? `
            <img src="${kid.photo}" alt="${kid.name}" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #122849; flex-shrink: 0; box-shadow: 0 3px 8px rgba(0,0,0,0.15);">
        ` : `
            <div class="kid-pic-circle">
                <i class="fa-solid fa-child"></i>
            </div>
        `;

        const card = document.createElement('div');
        card.className = 'kid-interactive-card';
        card.innerHTML = `
            <div class="kid-meta-row clickable-head" onclick="showEditKidModal('${kid._id}')" title="اضغط لتعديل بيانات الطفل">
                <div class="kid-main-data">
                    ${avatarHtml}
                    <div class="kid-name-phone">
                        <h3>${kid.name} <i class="fa-solid fa-pen" style="font-size: 11px; color: #2563eb; margin-right: 4px;"></i></h3>
                        <div class="kid-sub-meta">
                            ${phoneHtml}
                            ${birthdateHtml}
                        </div>
                    </div>
                </div>
                <div class="kid-total-score-chip">
                    <i class="fa-solid fa-star"></i>
                    <span>${kidPoints} نقطة</span>
                </div>
            </div>

            <div class="points-actions-grid">
                <button class="point-pill-btn ${record.liturgy ? 'active' : ''}" onclick="toggleKidPoint('${kid._id}', 'liturgy')">
                    <div class="pill-label-icon">
                        <i class="fa-solid fa-church"></i>
                        <span>القداس</span>
                    </div>
                    <span class="pill-points-tag">+5</span>
                </button>

                <button class="point-pill-btn ${record.sundaySchool ? 'active' : ''}" onclick="toggleKidPoint('${kid._id}', 'sundaySchool')">
                    <div class="pill-label-icon">
                        <i class="fa-solid fa-book-bible"></i>
                        <span>مدرسة الأحد</span>
                    </div>
                    <span class="pill-points-tag">+5</span>
                </button>

                <button class="point-pill-btn ${record.recitation ? 'active' : ''}" onclick="toggleKidPoint('${kid._id}', 'recitation')">
                    <div class="pill-label-icon">
                        <i class="fa-solid fa-lightbulb"></i>
                        <span>تسميع الآية</span>
                    </div>
                    <span class="pill-points-tag">+5</span>
                </button>

                <button class="point-pill-btn visitation-btn ${record.visitation ? 'active' : ''}" onclick="toggleKidPoint('${kid._id}', 'visitation')">
                    <div class="pill-label-icon">
                        <i class="fa-solid fa-phone-volume"></i>
                        <span>الافتقاد</span>
                    </div>
                    <span class="pill-points-tag">تم</span>
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    document.getElementById('totalPointsToday').textContent = weekTotalPoints;
    document.getElementById('attendedTodayNum').textContent = weekAttendedCount;
}

// ==========================================
// أدوات قص الصور
// ==========================================
function setupPhotoInputForCrop(inputElement, targetType) {
    if (!inputElement) return;
    inputElement.addEventListener('change', function(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        currentTargetPhotoType = targetType;
        const reader = new FileReader();
        reader.onload = function(event) {
            const imageToCrop = document.getElementById('imageToCrop');
            imageToCrop.src = event.target.result;

            document.getElementById('cropModal').style.display = 'flex';

            if (currentCropper) {
                currentCropper.destroy();
            }

            currentCropper = new Cropper(imageToCrop, {
                aspectRatio: 1,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.85,
                restore: false,
                guides: false,
                center: true,
                highlight: false,
                cropBoxMovable: false,
                cropBoxResizable: false,
                toggleDragModeOnDblclick: false
            });
        };
        reader.readAsDataURL(file);
    });
}

function applyCrop() {
    if (!currentCropper) return;

    const canvas = currentCropper.getCroppedCanvas({
        width: 180,
        height: 180,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });

    if (canvas) {
        croppedImageBase64 = canvas.toDataURL('image/jpeg', 0.65);
    }

    cancelCrop();
}

function cancelCrop() {
    const modal = document.getElementById('cropModal');
    if (modal) modal.style.display = 'none';
    if (currentCropper) {
        currentCropper.destroy();
        currentCropper = null;
    }
}

function goToSelectUser() {
    window.location.href = '/views/select-user.html';
}

document.addEventListener('DOMContentLoaded', () => {
    fetchWeeksFromDB();
    fetchKidsFromDB();

    const addPhotoInput = document.getElementById('inputKidPhoto');
    if (addPhotoInput) setupPhotoInputForCrop(addPhotoInput, 'create');

    const editPhotoInput = document.getElementById('editKidPhoto');
    if (editPhotoInput) setupPhotoInputForCrop(editPhotoInput, 'edit');
});