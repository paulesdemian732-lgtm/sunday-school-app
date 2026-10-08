document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('passwordInput');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const loginForm = document.getElementById('loginForm');
    const errorBox = document.getElementById('errorBox');
    const loginBtn = document.getElementById('loginBtn');

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                togglePasswordBtn.textContent = 'إخفاء';
            } else {
                passwordInput.type = 'password';
                togglePasswordBtn.textContent = 'إظهار';
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorBox.textContent = '';
            errorBox.className = 'alert-box';

            const enteredPassword = passwordInput.value.trim();

            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span>جاري التحقق...</span>';

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: enteredPassword })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    errorBox.textContent = 'تم تسجيل الدخول بنجاح!';
                    errorBox.classList.add('success');
                    setTimeout(() => {
                        window.location.href = data.redirectUrl || '/views/select-user.html';
                    }, 300);
                } else {
                    errorBox.textContent = data.message || 'كلمة المرور غير صحيحة';
                    errorBox.classList.add('error');
                }
            } catch (err) {
                // حالة الدخول الاحتياطية في حال تعثر الاتصال بالـ API
                if (enteredPassword === '#2027') {
                    window.location.href = '/views/select-user.html';
                } else {
                    errorBox.textContent = 'كلمة المرور غير صحيحة';
                    errorBox.classList.add('error');
                }
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<span>دخول</span> <i class="fa-solid fa-arrow-right-to-bracket enter-arrow"></i>';
            }
        });
    }
});