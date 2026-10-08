// دالة مساعدة لتجنب أي مشاكل في النصوص
function reportEscape(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// مطابقة اسم الخادم بمرونة (سواء بولس أو بولس دميان)
function isSameServant(servantA, servantB) {
    if (!servantA || !servantB) return false;
    const a = servantA.trim().toLowerCase();
    const b = servantB.trim().toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
}

// -------------------------------------------------------------
// 1. تقرير أطفال خادم معين (فصل واحد)
// -------------------------------------------------------------
async function generateClassPDFReport() {
    const servant = sessionStorage.getItem('currentServant') || 'بولس دميان';
    
    let allKids = [];
    let allWeeks = [];
    
    try {
        // جلب البيانات من المتغيرات العامة إذا كانت موجودة، أو من السيرفر مباشرة
        if (typeof globalKids !== 'undefined' && globalKids.length > 0) {
            allKids = globalKids;
        } else {
            const kidsRes = await fetch('/api/children');
            allKids = await kidsRes.json();
        }

        if (typeof globalWeeks !== 'undefined' && globalWeeks.length > 0) {
            allWeeks = globalWeeks;
        } else {
            const weeksRes = await fetch('/api/weeks');
            allWeeks = await weeksRes.json();
        }
    } catch (e) {
        alert('حدث خطأ أثناء الاتصال بقاعدة البيانات لجلب التقرير.');
        return;
    }

    const servantKids = allKids.filter(k => isSameServant(k.servant, servant));
    const servantWeeks = allWeeks
        .filter(w => isSameServant(w.servant, servant))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (servantKids.length === 0) {
        alert('لا يوجد أطفال مسجلين في فصلك بعد لاستخراج تقرير.');
        return;
    }

    buildAndPrintReport(servantKids, servantWeeks, `كشف الحضور والمتابعة للفصل - الخادم: ${servant}`, servant);
}

// -------------------------------------------------------------
// 2. تقرير إحصائية جميع أطفال المرحلة كاملة
// -------------------------------------------------------------
async function generateAllKidsPDFReport() {
    let allKids = [];
    let allWeeks = [];
    
    try {
        if (typeof allKidsData !== 'undefined' && allKidsData.length > 0) {
            allKids = allKidsData;
        } else {
            const kidsRes = await fetch('/api/children');
            allKids = await kidsRes.json();
        }

        const weeksRes = await fetch('/api/weeks');
        allWeeks = await weeksRes.json();
    } catch (e) {
        alert('حدث خطأ أثناء استرجاع البيانات العامة من السيرفر.');
        return;
    }

    if (allKids.length === 0) {
        alert('لا يوجد أطفال مسجلين في المرحلة بعد لاستخراج التقرير العام.');
        return;
    }

    const sortedKids = [...allKids].sort((a, b) => (a.servant || '').localeCompare(b.servant || '') || (a.name || '').localeCompare(b.name || ''));

    buildAndPrintReport(sortedKids, allWeeks, 'كشف الحضور والمتابعة العام - جميع أطفال المرحلة', 'جميع الخدام', true);
}

// -------------------------------------------------------------
// الدالة المشتركة لبناء الـ HTML والطباعة
// -------------------------------------------------------------
function buildAndPrintReport(kidsList, weeksList, reportTitle, servantLabel, isGlobal = false) {
    let reportArea = document.getElementById('printableReportArea');
    if (reportArea) {
        reportArea.remove();
    }

    reportArea = document.createElement('div');
    reportArea.id = 'printableReportArea';
    reportArea.className = 'report-sheet-container';

    const currentDateStr = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    let reportHtml = `
        <div class="report-official-header">
            <div class="report-header-titles">
                <h2>${reportEscape(reportTitle)}</h2>
                <p>مدارس الأحد - الصف الأول الابتدائي | سجل المتابعة والتقييم الشامل</p>
            </div>
            <div class="report-header-meta">
                <div><strong>الجهة / الخادم:</strong> ${reportEscape(servantLabel)}</div>
                <div><strong>تاريخ الاستخراج:</strong> ${currentDateStr}</div>
                <div><strong>إجمالي عدد الأطفال:</strong> ${kidsList.length} طفل</div>
            </div>
        </div>
    `;

    kidsList.forEach((kid, idx) => {
        let totalPts = 0;
        let liturgyCount = 0;
        let schoolCount = 0;
        let recitationCount = 0;
        let visitationCount = 0;

        if (kid.records) {
            const recordsObj = kid.records instanceof Map ? Object.fromEntries(kid.records) : kid.records;
            Object.values(recordsObj).forEach(rec => {
                if (rec.liturgy) { totalPts += 5; liturgyCount++; }
                if (rec.sundaySchool) { totalPts += 5; schoolCount++; }
                if (rec.recitation) { totalPts += 5; recitationCount++; }
                if (rec.visitation) { visitationCount++; }
            });
        }

        const phoneDisplay = kid.phone || 'غير مسجل';
        const birthdateDisplay = kid.birthdate || 'غير مسجل';
        
        const kidWeeks = isGlobal 
            ? weeksList.filter(w => isSameServant(w.servant, kid.servant)).sort((a, b) => new Date(a.date) - new Date(b.date))
            : weeksList;

        const totalWeeksCount = kidWeeks.length;

        // صورة البروفايل بأبعاد ثابتة 52px
        const avatarHtml = kid.photo
            ? `<img src="${kid.photo}" alt="${reportEscape(kid.name)}" class="pdf-kid-avatar-img" style="width: 52px; height: 52px; min-width: 52px; min-height: 52px; max-width: 52px; max-height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #08111e; display: inline-block;">`
            : `<div class="pdf-kid-avatar-default" style="width: 52px; height: 52px; min-width: 52px; min-height: 52px; border-radius: 50%; background-color: #08111e; color: #ffffff; display: flex; justify-content: center; align-items: center; font-size: 20px;">
                    <i class="fa-solid fa-child"></i>
               </div>`;

        // 1. جدول الأسابيع
        let tableRowsHtml = '';
        if (kidWeeks.length === 0) {
            tableRowsHtml = `<tr><td colspan="6" style="color: #64748b; padding: 10px;">لا توجد أسابيع مسجلة لهذا الفصل بعد</td></tr>`;
        } else {
            const recordsObj = kid.records instanceof Map ? Object.fromEntries(kid.records) : (kid.records || {});
            kidWeeks.forEach((w, wIndex) => {
                const rec = recordsObj[w.id] || {
                    liturgy: false, sundaySchool: false, recitation: false, visitation: false
                };

                let weekPts = 0;
                if (rec.liturgy) weekPts += 5;
                if (rec.sundaySchool) weekPts += 5;
                if (rec.recitation) weekPts += 5;

                tableRowsHtml += `
                    <tr>
                        <td><strong>${wIndex + 1}</strong> (${reportEscape(w.date)})</td>
                        <td>${rec.liturgy ? '<span class="pdf-check">✔</span>' : '<span class="pdf-cross">✘</span>'}</td>
                        <td>${rec.sundaySchool ? '<span class="pdf-check">✔</span>' : '<span class="pdf-cross">✘</span>'}</td>
                        <td>${rec.recitation ? '<span class="pdf-check">✔</span>' : '<span class="pdf-cross">✘</span>'}</td>
                        <td>${rec.visitation ? '<span class="pdf-check">✔ تم</span>' : '<span class="pdf-cross">✘</span>'}</td>
                        <td><strong>+${weekPts}</strong></td>
                    </tr>
                `;
            });
        }

        // 2. سجل الملاحظات
        let notesHtml = '';
        if (kid.notes && kid.notes.length > 0) {
            notesHtml = '<div class="pdf-notes-list">';
            kid.notes.forEach(n => {
                notesHtml += `
                    <div class="pdf-single-note">
                        <span class="pdf-note-date">[${reportEscape(n.date)}]</span>
                        ${isGlobal ? `<strong>(الخادم: ${reportEscape(n.servant || kid.servant)}):</strong> ` : ''}
                        <span class="pdf-note-content">${reportEscape(n.text)}</span>
                    </div>
                `;
            });
            notesHtml += '</div>';
        } else {
            notesHtml = `<div class="pdf-empty-notes">لا توجد ملاحظات مسجلة لهذا الطفل حتى الآن.</div>`;
        }

        // 3. كارت التقرير
        reportHtml += `
            <div class="pdf-kid-card">
                <div class="pdf-kid-head">
                    <div class="pdf-kid-identity-wrap">
                        ${avatarHtml}
                        <div class="pdf-kid-info">
                            <h3>${idx + 1}. ${reportEscape(kid.name)} ${isGlobal ? `<span style="font-size:12px; color:#2563eb; font-weight:700;">(الخادم: ${reportEscape(kid.servant)})</span>` : ''}</h3>
                            <div class="pdf-kid-subinfo">
                                <span>📞 هاتف ولي الأمر: <strong>${reportEscape(phoneDisplay)}</strong></span>
                                <span>🎂 تاريخ الميلاد: <strong>${reportEscape(birthdateDisplay)}</strong></span>
                            </div>
                        </div>
                    </div>
                    <div class="pdf-kid-total-pts">
                        مجموع النقاط: ${totalPts} نقطة
                    </div>
                </div>

                <div class="pdf-summary-grid">
                    <div class="pdf-stat-item">
                        <span class="stat-title">حضور القداس</span>
                        <span class="stat-val" style="direction: rtl;">${liturgyCount} من ${totalWeeksCount}</span>
                    </div>
                    <div class="pdf-stat-item">
                        <span class="stat-title">حضور مدارس الأحد</span>
                        <span class="stat-val" style="direction: rtl;">${schoolCount} من ${totalWeeksCount}</span>
                    </div>
                    <div class="pdf-stat-item">
                        <span class="stat-title">تسميع الآية</span>
                        <span class="stat-val" style="direction: rtl;">${recitationCount} من ${totalWeeksCount}</span>
                    </div>
                    <div class="pdf-stat-item">
                        <span class="stat-title">مرات الافتقاد</span>
                        <span class="stat-val">${visitationCount}</span>
                    </div>
                </div>

                <div class="pdf-table-wrapper">
                    <table class="pdf-weeks-table">
                        <thead>
                            <tr>
                                <th>الأسبوع والتاريخ</th>
                                <th>القداس</th>
                                <th>مدارس الأحد</th>
                                <th>تسميع الآية</th>
                                <th>الافتقاد</th>
                                <th>نقاط الأسبوع</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>

                <div class="pdf-notes-section">
                    <h4>📝 سجل الملاحظات والمتابعة السلوكية:</h4>
                    ${notesHtml}
                </div>
            </div>
        `;
    });

    reportArea.innerHTML = reportHtml;
    document.body.appendChild(reportArea);

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            if (reportArea) reportArea.remove();
        }, 1000);
    }, 300);
}