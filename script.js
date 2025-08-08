// Dados dos projetos
const projectsData = {
    'apostas-max': {
        title: 'ApostasMax',
        description: 'Portal completo de loterias desenvolvido em Python com Flask. Sistema de geradores inteligentes para diferentes loterias, desdobramentos matemáticos e integração com API da Caixa Econômica Federal.',
        technologies: ['Python', 'Flask', 'MySQL', 'JavaScript', 'HTML', 'CSS'],
        images: ['Apostas Max web/1.png', 'Apostas Max web/2.png', 'Apostas Max web/3.png', 'Apostas Max web/4.png'],
        videoUrl: 'https://youtu.be/QbSPUfqbJdA'
    },
    'area-membros': {
        title: 'Área de Membros',
        description: 'Plataforma completa para gerenciamento de cursos online com React, TypeScript e PHP. Sistema de autenticação, progresso individual, player de vídeo integrado e chat em tempo real.',
        technologies: ['React', 'TypeScript', 'PHP', 'MySQL', 'Tailwind CSS', 'Framer Motion'],
        images: ['Área de Membros web/1.png', 'Área de Membros web/2.png', 'Área de Membros web/3.png', 'Área de Membros web/4.png', 'Área de Membros web/5.png', 'Área de Membros web/6.png', 'Área de Membros web/7.png', 'Área de Membros web/8.png', 'Área de Membros web/9.png', 'Área de Membros web/10.png', 'Área de Membros web/11.png'],
        videoUrl: 'https://www.youtube.com/watch?v=Ua-HHZDPJxw'
    },
    'conversor-moedas': {
        title: 'Conversor de Moedas',
        description: 'Conversor de moedas desenvolvido com Node.js e Express, oferecendo conversão em tempo real entre 150 moedas diferentes com atualizações automáticas via API externa.',
        technologies: ['Node.js', 'Express', 'JavaScript', 'HTML', 'CSS', 'Axios'],
        images: ['Conversor de Moedas WEB/1.png'],
        videoUrl: 'https://youtu.be/nBWXG9p8_oc'
    },
    'diet-transform': {
        title: 'Diet-Transform',
        description: 'Funil de vendas completo para produtos dietéticos com três páginas principais. Sistema de autenticação, área de membros com painel de progresso e cursos em vídeo.',
        technologies: ['HTML', 'CSS', 'JavaScript', 'MySQL', 'PHP'],
        images: ['Diet-Transform/1.png', 'Diet-Transform/2.png', 'Diet-Transform/3.png'],
        videoUrl: 'https://youtu.be/3ol5tkZ8Xy0'
    },
    'e-commerce': {
        title: 'StyleStore',
        description: 'Loja de roupas de comércio eletrônico moderna construída com HTML, CSS, JavaScript, PHP e MySQL. Sistema completo de autenticação, carrinho de compras e gerenciamento de produtos.',
        technologies: ['HTML', 'CSS', 'JavaScript', 'PHP', 'MySQL'],
        images: ['E-Commerce web/1.png', 'E-Commerce web/2.png', 'E-Commerce web/3.png'],
        videoUrl: 'https://youtu.be/3_uZiSALiMU'
    },
    'guia-nutricional': {
        title: 'Guia Nutricional',
        description: 'Aplicativo React Native completo para gerenciamento de saúde, nutrição e fitness. Planos alimentares personalizados, biblioteca de receitas e acompanhamento de progresso.',
        technologies: ['React Native', 'TypeScript', 'Expo', 'AsyncStorage', 'NativeWind'],
        images: ['Guia nutricional mobile/1.png', 'Guia nutricional mobile/2.png', 'Guia nutricional mobile/3.png', 'Guia nutricional mobile/4.png', 'Guia nutricional mobile/5.png', 'Guia nutricional mobile/6.png', 'Guia nutricional mobile/7.png', 'Guia nutricional mobile/8.png', 'Guia nutricional mobile/9.png', 'Guia nutricional mobile/10.png', 'Guia nutricional mobile/11.png', 'Guia nutricional mobile/12.png', 'Guia nutricional mobile/13.png', 'Guia nutricional mobile/14.png'],
        videoUrl: 'https://youtube.com/shorts/YK5u0UovdpA'
    },
    'padula': {
        title: 'Padula Accounting',
        description: 'Sistema de captura de leads com modal WhatsApp integrado. Front-end moderno com back-end Node.js e banco de dados SQLite para uma experiência fluida.',
        technologies: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'Express', 'SQLite'],
        images: ['Padula web/1.png', 'Padula web/2.png'],
        videoUrl: 'https://youtu.be/T7De7YKaxJw'
    },
    'pagina-vendas': {
        title: 'Página de Vendas',
        description: 'Landing page moderna para captura de leads com sistema modal inteligente. Design responsivo com backend PHP e integração com banco de dados MySQL.',
        technologies: ['HTML', 'CSS', 'JavaScript', 'PHP', 'MySQL'],
        images: ['Página de Vendas/1.png', 'Página de Vendas/2.png', 'Página de Vendas/3.png', 'Página de Vendas/4.png', 'Página de Vendas/5.png', 'Página de Vendas/6.png', 'Página de Vendas/7.png', 'Página de Vendas/8.png'],
        videoUrl: 'https://youtu.be/A4QI4wjRg9s'
    },
    'pizzaria-mobile': {
        title: 'Pizzaria Mobile',
        description: 'Aplicativo de e-commerce em React Native com TypeScript e Expo Go para pedidos de pizza. Sistema completo de autenticação, catálogo dinâmico e carrinho de compras.',
        technologies: ['React Native', 'TypeScript', 'Expo', 'MySQL', 'AsyncStorage'],
        images: ['Pizzaria mobile/1.jfif', 'Pizzaria mobile/2.jfif', 'Pizzaria mobile/3.jfif', 'Pizzaria mobile/4.jfif', 'Pizzaria mobile/5.jfif', 'Pizzaria mobile/6.jfif', 'Pizzaria mobile/7.jfif'],
        videoUrl: 'https://youtube.com/shorts/pVgTo6tIphk'
    },
    'pizzaria-web': {
        title: 'Pizzaria Web',
        description: 'Sistema de e-commerce para pizzaria com frontend responsivo e backend Node.js. Carrinho de compras interativo, carregamento dinâmico de menus e confirmações modais.',
        technologies: ['HTML', 'CSS', 'JavaScript', 'Node.js', 'Express', 'SQLite'],
        images: ['Pizzaria web/1.png', 'Pizzaria web/2.png', 'Pizzaria web/3.png'],
        videoUrl: 'https://youtu.be/8i5PQoHw9cc'
    },
    'robo-vendedor': {
        title: 'Robô Vendedor',
        description: 'Landing page moderna para captura de leads com modal inteligente. Sistema de validação em tempo real, integração com WhatsApp e design responsivo.',
        technologies: ['HTML', 'CSS', 'JavaScript', 'PHP', 'MySQL'],
        images: ['Robo Vendedor web/1.png', 'Robo Vendedor web/2.png', 'Robo Vendedor web/3.png'],
        videoUrl: 'https://youtu.be/LXiqHN8r4xA'
    },
    'reforco-online': {
        title: 'Reforço Online',
        description: 'Plataforma completa que conecta alunos e professores para aulas de reforço escolar online. Sistema de chat em tempo real, dashboard para gestão de aulas, upload de materiais didáticos e controle de disponibilidade. Interface moderna com React e TypeScript, backend PHP com APIs RESTful e banco MySQL.',
        technologies: ['React', 'TypeScript', 'PHP', 'MySQL', 'CSS3', 'JavaScript'],
        images: ['Reforço Online/1.png', 'Reforço Online/2.png', 'Reforço Online/3.png', 'Reforço Online/4.png', 'Reforço Online/5.png', 'Reforço Online/6.png', 'Reforço Online/7.png', 'Reforço Online/8.png', 'Reforço Online/9.png', 'Reforço Online/10.png', 'Reforço Online/11.png', 'Reforço Online/12.png', 'Reforço Online/13.png', 'Reforço Online/14.png', 'Reforço Online/15.png', 'Reforço Online/16.png', 'Reforço Online/17.png', 'Reforço Online/18.png'],
        videoUrl: 'https://youtu.be/GWz9RJ-Kx9U'
    }
};

// Função para extrair ID do YouTube da URL
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Função para criar iframe do YouTube
function createYouTubeEmbed(url) {
    const videoId = extractYouTubeId(url);
    if (videoId) {
        return `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
    return `<p>Vídeo não disponível</p>`;
}

// Elementos DOM
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const modal = document.getElementById('projectModal');
const modalContent = document.getElementById('modalContent');
const closeBtn = document.querySelector('.close');
const projectCards = document.querySelectorAll('.project-card');

// Menu mobile
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Fechar menu ao clicar em um link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Smooth scrolling para links de navegação
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        
        if (targetSection) {
            targetSection.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Modal de projetos
projectCards.forEach(card => {
    card.addEventListener('click', () => {
        const projectId = card.getAttribute('data-project');
        openProjectModal(projectId);
    });
});

// Função para abrir modal do projeto
function openProjectModal(projectId) {
    const project = projectsData[projectId];
    if (!project) return;

    const modal = document.getElementById('projectModal');
    const modalContent = document.getElementById('modalContent');
    
    // Limpar conteúdo anterior
    modalContent.innerHTML = '';
    
    // Criar conteúdo do modal
    const content = `
        <div class="modal-header">
            <h2>${project.title}</h2>
            <button class="close-btn" onclick="closeProjectModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="project-description">
                <p>${project.description}</p>
            </div>
            
            <div class="project-technologies">
                <h3>Tecnologias Utilizadas:</h3>
                <div class="tech-tags">
                    ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                </div>
            </div>
            
            <div class="project-media">
                <div class="video-section">
                    <h3>Demonstração em Vídeo:</h3>
                    <div class="video-container">
                        ${createYouTubeEmbed(project.videoUrl)}
                    </div>
                </div>
                
                <div class="images-section">
                    <h3>Imagens do Projeto:</h3>
                    <div class="image-gallery">
                        ${project.images.map(img => `
                            <div class="gallery-item">
                                <img src="${img}" alt="${project.title}" onclick="openImageModal('${img}')">
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modalContent.innerHTML = content;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Fechar modal
closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
});

// Fechar modal ao clicar fora dele
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

// Função para fechar modal do projeto
function closeProjectModal() {
    const modal = document.getElementById('projectModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Função para abrir modal de imagem
function openImageModal(imageSrc) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    
    modalImage.src = imageSrc;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Função para fechar modal de imagem
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Fechar modais ao clicar fora deles
window.addEventListener('click', (event) => {
    const projectModal = document.getElementById('projectModal');
    const imageModal = document.getElementById('imageModal');
    
    if (event.target === projectModal) {
        closeProjectModal();
    }
    
    if (event.target === imageModal) {
        closeImageModal();
    }
});

// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(0, 0, 0, 0.99)';
        header.style.boxShadow = '0 4px 25px rgba(59, 130, 246, 0.2)';
        header.style.borderBottom = '2px solid rgba(59, 130, 246, 0.3)';
    } else {
        header.style.background = 'rgba(0, 0, 0, 0.98)';
        header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
        header.style.borderBottom = '2px solid rgba(59, 130, 246, 0.2)';
    }
});

// Animação de entrada dos elementos
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

// Observar elementos para animação
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.project-card, .skill-category');
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Adicionar estilos CSS para o modal de imagem
const imageModalStyles = `
    .image-modal {
        position: fixed;
        z-index: 3000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
    }
    
    .image-modal-content {
        position: relative;
        max-width: 90%;
        max-height: 90%;
    }
    
    .image-modal-content img {
        width: 100%;
        height: auto;
        border-radius: 10px;
    }
    
    .image-close {
        position: absolute;
        top: -40px;
        right: 0;
        color: white;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
    }
    
    .project-modal-content h2 {
        color: #333;
        margin-bottom: 1rem;
        font-size: 2rem;
    }
    
    .project-description {
        color: #666;
        line-height: 1.6;
        margin-bottom: 2rem;
        font-size: 1.1rem;
    }
    
    .project-details {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
        margin-bottom: 2rem;
    }
    
    .project-tech-stack h4,
    .project-features h4 {
        color: #667eea;
        margin-bottom: 1rem;
        font-size: 1.2rem;
    }
    
    .tech-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    
    .tech-tag {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
    }
    
    .project-features ul {
        list-style: none;
        padding: 0;
    }
    
    .project-features li {
        padding: 0.5rem 0;
        color: #666;
        position: relative;
        padding-left: 1.5rem;
    }
    
    .project-features li::before {
        content: '▹';
        position: absolute;
        left: 0;
        color: #667eea;
        font-weight: bold;
    }
    
    .project-gallery,
    .project-video {
        margin-top: 2rem;
    }
    
    .project-gallery h4,
    .project-video h4 {
        color: #667eea;
        margin-bottom: 1rem;
        font-size: 1.2rem;
    }
    
    .gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }
    
    .gallery-item img {
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: 10px;
        cursor: pointer;
        transition: transform 0.3s ease;
    }
    
    .gallery-item img:hover {
        transform: scale(1.05);
    }
    
    .project-video video {
        width: 100%;
        border-radius: 10px;
    }
    
    @media (max-width: 768px) {
        .project-details {
            grid-template-columns: 1fr;
        }
        
        .gallery-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }
    }
`;

// Adicionar estilos ao head
const styleSheet = document.createElement('style');
styleSheet.textContent = imageModalStyles;
document.head.appendChild(styleSheet); 