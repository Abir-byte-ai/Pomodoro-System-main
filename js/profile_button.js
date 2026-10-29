// ============================================
// Profile Button
// Makes the sidebar user card a clickable link
// to profile.html on every page
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const userProfile = document.querySelector('.user-profile');
    if (!userProfile) return;

    // Style it as a button
    userProfile.style.cursor   = 'pointer';
    userProfile.title          = 'Edit profile';
    userProfile.style.transition = 'opacity 0.2s';

    userProfile.addEventListener('mouseenter', () => { userProfile.style.opacity = '0.8'; });
    userProfile.addEventListener('mouseleave', () => { userProfile.style.opacity = '1'; });

    userProfile.addEventListener('click', () => {
        window.location.href = 'profile.html';
    });
});
