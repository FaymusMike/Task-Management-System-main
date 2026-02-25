// routing-fix.js - Fix navigation issues
(function() {
    // Fix for all navigation links
    function fixNavigation() {
        // Get all anchor tags that might be navigation links
        document.addEventListener('click', function(e) {
            // Find if the clicked element or its parent is a navigation link
            let target = e.target;
            while (target && target.tagName !== 'A') {
                target = target.parentElement;
            }
            
            if (!target) return;
            
            const href = target.getAttribute('href');
            
            // Skip if no href, external link, or anchor link
            if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) {
                return;
            }
            
            // Handle internal navigation
            e.preventDefault();
            
            // Get the current path to determine relative vs absolute
            const currentPath = window.location.pathname;
            const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
            
            // Construct full URL
            let fullPath;
            if (href.startsWith('/')) {
                fullPath = href;
            } else {
                fullPath = basePath + href;
            }
            
            console.log('Navigating to:', fullPath);
            window.location.href = fullPath;
        });
    }
    
    // Fix for sidebar links specifically
    function fixSidebarLinks() {
        const sidebarLinks = document.querySelectorAll('.sidebar-menu a, .sidebar a');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                
                // Skip if no href or external
                if (!href || href.startsWith('http') || href.startsWith('#')) {
                    return;
                }
                
                e.preventDefault();
                
                // Get the current directory
                const currentPath = window.location.pathname;
                const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                
                // Navigate
                window.location.href = currentDir + href;
            });
        });
    }
    
    // Run fixes when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            fixNavigation();
            fixSidebarLinks();
        });
    } else {
        fixNavigation();
        fixSidebarLinks();
    }
    
    // Also run after dynamic content changes
    const observer = new MutationObserver(function() {
        fixSidebarLinks();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();