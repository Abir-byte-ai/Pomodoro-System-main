// ============================================
// UI Icons (Lucide)
// Time Management and Pomodoro Tracker
//
// Tiny helper for icons that are built in JavaScript
// (task cards, activity rows, insights, dark mode toggle...).
// Static HTML uses the same markup directly:
//   <svg class="ui-icon" aria-hidden="true" focusable="false">
//     <use href="icons/lucide-sprite.svg#timer"></use>
//   </svg>
//
// Load this BEFORE the other page scripts.
// Styling lives in css/icons.css.
// ============================================

(function (global) {
    'use strict';

    // All pages sit in the project root, so this path is relative to them.
    var SPRITE = 'icons/lucide-sprite.svg';

    // Returns an <svg> markup string for the given Lucide icon name.
    //   UIIcons.svg('timer')
    //   UIIcons.svg('loader-circle', 'ui-icon--spin')
    // Icons are decorative by default (aria-hidden); put the accessible
    // name on the surrounding button/link instead.
    function svg(name, extraClass) {
        var cls = 'ui-icon' + (extraClass ? ' ' + extraClass : '');
        return '<svg class="' + cls + '" aria-hidden="true" focusable="false">' +
               '<use href="' + SPRITE + '#' + name + '"></use></svg>';
    }

    // Shared by login.html and register.html: swap the eye icon and keep the
    // accessible name / pressed state in sync with the field's visibility.
    function setPasswordToggle(btn, isVisible) {
        btn.innerHTML = svg(isVisible ? 'eye-off' : 'eye');
        btn.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
        btn.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
    }

    global.UIIcons = {
        SPRITE: SPRITE,
        svg: svg,
        setPasswordToggle: setPasswordToggle
    };
})(window);
