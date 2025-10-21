document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('.tab');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function initTabs() {
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                
                // Remove active class from all tabs and panels
                tabs.forEach(t => t.classList.remove('active'));
                tabPanels.forEach(p => p.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding panel
                this.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
                
                // Add smooth transition effect
                document.getElementById(targetTab).style.opacity = '0';
                setTimeout(() => {
                    document.getElementById(targetTab).style.opacity = '1';
                }, 100);
            });
        });
    }

    // Smooth scroll animation for elements
    function initScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe elements for animation
        const animatedElements = document.querySelectorAll('.book-card, .biography-list li, .personal-info');
        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    }

    // Book card hover effects
    function initBookCardEffects() {
        const bookCards = document.querySelectorAll('.book-card');
        
        bookCards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-8px) scale(1.02)';
                this.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.2)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
            });
        });
    }

    // Personal info list animation
    function initPersonalInfoAnimation() {
        const infoItems = document.querySelectorAll('.info-list li');
        
        infoItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            setTimeout(() => {
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, index * 200);
        });
    }

    // Header scroll effect
    function initHeaderScrollEffect() {
        const header = document.querySelector('.header');
        let lastScrollY = window.scrollY;
        
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                // Scrolling down
                header.style.transform = 'translateY(-100%)';
            } else {
                // Scrolling up
                header.style.transform = 'translateY(0)';
            }
            
            lastScrollY = currentScrollY;
        });
    }

    // Smooth transitions for tab content
    function initTabTransitions() {
        const tabContent = document.querySelector('.tab-content');
        
        // Add transition styles
        const style = document.createElement('style');
        style.textContent = `
            .tab-panel {
                transition: opacity 0.3s ease-in-out;
            }
            .tab-panel:not(.active) {
                opacity: 0;
                pointer-events: none;
            }
            .tab-panel.active {
                opacity: 1;
                pointer-events: auto;
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize all functionality
    function init() {
        initTabs();
        initScrollAnimations();
        initBookCardEffects();
        initPersonalInfoAnimation();
        initHeaderScrollEffect();
        initTabTransitions();
        
        // Add loading animation
        document.body.style.opacity = '0';
        setTimeout(() => {
            document.body.style.transition = 'opacity 0.5s ease';
            document.body.style.opacity = '1';
        }, 100);
    }

    // Run initialization
    init();

    // Add some interactive feedback
    console.log('About page loaded successfully!');
    
    // Optional: Add keyboard navigation for tabs
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const activeTab = document.querySelector('.tab.active');
            const activeIndex = Array.from(tabs).indexOf(activeTab);
            
            if (e.key === 'ArrowLeft' && activeIndex > 0) {
                tabs[activeIndex - 1].click();
            } else if (e.key === 'ArrowRight' && activeIndex < tabs.length - 1) {
                tabs[activeIndex + 1].click();
            }
        }
    });
});

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add resize handler for responsive behavior
window.addEventListener('resize', debounce(() => {
    // Recalculate any layout-dependent features
    const bookCards = document.querySelectorAll('.book-card');
    bookCards.forEach(card => {
        card.style.transform = '';
        card.style.boxShadow = '';
    });
}, 250));

