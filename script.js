// Dados dos projetos
const projectsData = {
    'apostas-max': {
        title: 'ApostasMax',
        description: 'Portal completo de loterias brasileiras com geradores inteligentes e desdobramentos matemáticos. Desenvolvido em Python com Flask, oferece ferramentas especializadas para apostadores de loteria, incluindo geradores que permitem excluir números indesejados e selecionar preferências. O sistema implementa algoritmos JavaScript para gerar combinações aleatórias respeitando as regras específicas de cada jogo.',
        technologies: ['Python', 'Flask', 'JavaScript', 'MySQL', 'PyMySQL'],
        features: [
            'Geradores inteligentes para diferentes loterias',
            'Desdobramentos matemáticos com garantias',
            'Integração com API da Caixa Econômica',
            'Sistema de autenticação e sessões',
            'Interface responsiva e moderna'
        ],
        images: [
            'Apostas Max web/1.png',
            'Apostas Max web/2.png',
            'Apostas Max web/3.png',
            'Apostas Max web/4.png'
        ],
        video: 'Apostas Max web/6.mp4'
    },
    'area-membros': {
        title: 'Área de Membros',
        description: 'Plataforma completa para gerenciamento de cursos online desenvolvida com React, TypeScript e PHP. O sistema oferece autenticação segura, progresso individual por usuário, player de vídeo integrado para 12 aulas do YouTube, comunidade com chat em tempo real, e interface responsiva com animações modernas.',
        technologies: ['React 18', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'PHP 8+', 'MySQL'],
        features: [
            'Sistema de autenticação completo',
            'Progresso individual por usuário',
            'Player de vídeo integrado (12 aulas)',
            'Chat em tempo real para comunidade',
            'Dashboard personalizado',
            'Sistema de segurança robusto'
        ],
        images: [
            'Área de Membros web/1.png',
            'Área de Membros web/2.png',
            'Área de Membros web/3.png',
            'Área de Membros web/4.png',
            'Área de Membros web/5.png',
            'Área de Membros web/6.png',
            'Área de Membros web/7.png',
            'Área de Membros web/8.png',
            'Área de Membros web/9.png',
            'Área de Membros web/10.png',
            'Área de Membros web/11.png'
        ],
        video: 'Área de Membros web/2025-08-05 00-37-58.mp4'
    },
    'conversor-moedas': {
        title: 'Conversor de Moedas',
        description: 'Conversor de moedas desenvolvido com Node.js e Express, oferecendo conversão em tempo real entre 150 moedas diferentes. O aplicativo combina uma API com uma interface web moderna, com atualizações automáticas a cada 5 minutos via API externa.',
        technologies: ['Node.js', 'Express', 'Axios', 'Node-Cron', 'HTML5', 'CSS3', 'JavaScript'],
        features: [
            'Conversão entre 150 moedas globais',
            'Atualizações automáticas a cada 5 minutos',
            'Interface moderna com design de morfismo de vidro',
            'Pesquisa inteligente e filtros',
            'Seção de moedas populares',
            'Indicador de status online/offline'
        ],
        images: [
            'Conversor de Moedas WEB/1.png'
        ],
        video: 'Conversor de Moedas WEB/2025-08-03 01-25-38.mp4'
    },
    'diet-transform': {
        title: 'Diet-Transform',
        description: 'Funil de vendas completo para produtos dietéticos, com três páginas principais para capturar leads e converter visitantes. A landing page apresenta um design moderno e responsivo, com seções de destaque, benefícios, depoimentos e uma garantia.',
        technologies: ['HTML5', 'CSS3', 'JavaScript ES6+', 'MySQL', 'Font Awesome', 'Google Fonts'],
        features: [
            'Landing page com modal de captura automática',
            'Sistema de registro/login com validação',
            'Área de membros com painel de progresso',
            'Sistema de conquistas e rastreamento',
            'Cursos em vídeo e downloads',
            'Análise de comportamento do usuário'
        ],
        images: [
            'Diet-Transform/1.png',
            'Diet-Transform/2.png',
            'Diet-Transform/3.png'
        ],
        video: 'Diet-Transform/8.mp4'
    },
    'e-commerce': {
        title: 'StyleStore',
        description: 'Loja de roupas de comércio eletrônico moderna construída com HTML, CSS, JavaScript, PHP e MySQL. Apresenta um design moderno em preto, branco e verde, com sistema completo de autenticação de usuário e funcionalidade de carrinho de compras.',
        technologies: ['HTML', 'CSS', 'JavaScript', 'PHP', 'MySQL'],
        features: [
            'Sistema completo de autenticação',
            'Funcionalidade de carrinho de compras',
            'Páginas detalhadas de produtos',
            'Filtragem por categorias',
            'Funcionalidade de busca',
            'Paginação (5 produtos por página)'
        ],
        images: [
            'E-Commerce web/1.png',
            'E-Commerce web/2.png',
            'E-Commerce web/3.png'
        ],
        video: 'E-Commerce web/8.mp4'
    },
    'guia-nutricional': {
        title: 'Guia Nutricional',
        description: 'Aplicativo completo de saúde e fitness desenvolvido com React Native e Expo. Oferece uma solução completa para gerenciamento de saúde, nutrição e fitness com planos alimentares personalizados, biblioteca de receitas e planos de exercícios.',
        technologies: ['React Native', 'Expo', 'TypeScript', 'NativeWind', 'AsyncStorage', 'React Navigation'],
        features: [
            'Planos alimentares personalizados',
            'Biblioteca de 500+ receitas low-carb',
            '500+ receitas low-calorie',
            'Planos de exercícios personalizados',
            'Acompanhamento de progresso',
            'Calculadora de IMC integrada'
        ],
        images: [
            'Guia nutricional mobile/1.png',
            'Guia nutricional mobile/2.png',
            'Guia nutricional mobile/3.png',
            'Guia nutricional mobile/4.png',
            'Guia nutricional mobile/5.png',
            'Guia nutricional mobile/6.png',
            'Guia nutricional mobile/7.png',
            'Guia nutricional mobile/8.png',
            'Guia nutricional mobile/9.png',
            'Guia nutricional mobile/10.png',
            'Guia nutricional mobile/11.png',
            'Guia nutricional mobile/12.png',
            'Guia nutricional mobile/13.png',
            'Guia nutricional mobile/14.png'
        ],
        video: 'Guia nutricional mobile/Untitled.mp4'
    },
    'padula': {
        title: 'Padula Accounting',
        description: 'Sistema de captura de leads para o site da Padula Accounting, integrando um modal que aparece quando o usuário clica no botão do WhatsApp. O sistema combina um front-end moderno com um back-end robusto para uma experiência de usuário fluida.',
        technologies: ['HTML5', 'CSS3', 'JavaScript', 'Node.js', 'Express.js', 'SQLite'],
        features: [
            'Modal inteligente de captura de leads',
            'Back-end Node.js com API REST',
            'Integração com WhatsApp',
            'Validação robusta em várias camadas',
            'Interface moderna com animações',
            'Armazenamento persistente com SQLite'
        ],
        images: [
            'Padula web/1.png',
            'Padula web/2.png'
        ],
        video: 'Padula web/1.mp4'
    },
    'pagina-vendas': {
        title: 'Página de Vendas',
        description: 'Landing page para produto que oferece um guia para auxiliar consumidores a removerem seus nomes e CPFs das "listas de restrição interna" mantidas por bancos e financeiras. O produto se posiciona como uma solução para o problema de ter o crédito negado.',
        technologies: ['HTML', 'CSS', 'JavaScript'],
        features: [
            'Landing page otimizada para conversão',
            'Sistema de captura de leads',
            'Página de vendas persuasiva',
            'Garantia de devolução do dinheiro',
            'Bônus relacionados ao crédito',
            'Promessa de resultados em 7 dias'
        ],
        images: [
            'Página de Vendas/1.png',
            'Página de Vendas/2.png',
            'Página de Vendas/3.png',
            'Página de Vendas/4.png',
            'Página de Vendas/5.png',
            'Página de Vendas/6.png',
            'Página de Vendas/7.png',
            'Página de Vendas/8.png'
        ],
        video: 'Página de Vendas/2025-08-05 01-39-26.mp4'
    },
    'pizzaria-mobile': {
        title: 'Pizzaria Mobile',
        description: 'Aplicativo de e-commerce em React Native com TypeScript e Expo Go, compatível com Android e iOS, oferecendo uma experiência moderna para pedidos de pizza. Inclui sistema completo de autenticação, catálogo de produtos e carrinho de compras.',
        technologies: ['React Native', 'TypeScript', 'Expo Go', 'AsyncStorage', 'Context API', 'MySQL'],
        features: [
            'Sistema de autenticação completo',
            'Catálogo com categorias (Pizzas, Bebidas, Combos, Doces)',
            'Carrinho de compras interativo',
            'Interface adaptativa com saudação personalizada',
            'Validação de duplicatas (login/email único)',
            'Design system com cores azul e gradientes'
        ],
        images: [
            'Pizzaria mobile/1.jfif',
            'Pizzaria mobile/2.jfif',
            'Pizzaria mobile/3.jfif',
            'Pizzaria mobile/4.jfif',
            'Pizzaria mobile/5.jfif',
            'Pizzaria mobile/6.jfif',
            'Pizzaria mobile/7.jfif'
        ],
        video: 'Pizzaria mobile/1.mp4'
    },
    'pizzaria-web': {
        title: 'Pizzaria Web',
        description: 'Site de e-commerce para pizzaria com design responsivo e navegação entre as páginas Início, Menu e Sobre. Carregamento dinâmico de menus via API, carrinho de compras interativo com persistência localStorage e confirmações modais estilizadas.',
        technologies: ['HTML5', 'CSS3', 'JavaScript ES6+', 'Node.js', 'Express.js', 'SQLite3'],
        features: [
            'Design responsivo com navegação entre páginas',
            'Carregamento dinâmico de menus via API',
            'Carrinho de compras interativo',
            'Persistência localStorage',
            'Confirmações modais estilizadas',
            'Banco de dados SQLite com produtos de exemplo'
        ],
        images: [
            'Pizzaria web/1.png',
            'Pizzaria web/2.png',
            'Pizzaria web/3.png'
        ],
        video: 'Pizzaria web/9.mp4'
    },
    'robo-vendedor': {
        title: 'Robô Vendedor',
        description: 'Landing page moderna e responsiva, projetada para capturar leads por meio de um sistema modal inteligente. Desenvolvido com HTML5, CSS3 e JavaScript, com backend PHP e integração com banco de dados MySQL.',
        technologies: ['HTML5', 'CSS3', 'JavaScript', 'PHP', 'MySQL'],
        features: [
            'Design responsivo para todos os dispositivos',
            'Modal de captura inteligente de leads',
            'Validação em tempo real',
            'Mascaramento de número de telefone',
            'Prevenção de envios duplicados',
            'Integração de backend com PHP'
        ],
        images: [
            'Robo Vendedor web/1.png',
            'Robo Vendedor web/2.png',
            'Robo Vendedor web/3.png'
        ],
        video: 'Robo Vendedor web/4.mp4'
    }
};

// Elementos DOM
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const modal = document.getElementById('projectModal');
const modalContent = document.querySelector('.modal-content');
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
        const projectData = projectsData[projectId];
        
        if (projectData) {
            openProjectModal(projectData);
        }
    });
});

function openProjectModal(project) {
    const modalBody = document.querySelector('.modal-body');
    
    let imagesHTML = '';
    if (project.images && project.images.length > 0) {
        imagesHTML = `
            <div class="project-gallery">
                <h4>Galeria de Imagens</h4>
                <div class="gallery-grid">
                    ${project.images.map(img => `
                        <div class="gallery-item">
                            <img src="${img}" alt="${project.title}" onclick="openImageModal('${img}')">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    let videoHTML = '';
    if (project.video) {
        videoHTML = `
            <div class="project-video">
                <h4>Demonstração em Vídeo</h4>
                <video controls>
                    <source src="${project.video}" type="video/mp4">
                    Seu navegador não suporta vídeos.
                </video>
            </div>
        `;
    }

    modalBody.innerHTML = `
        <div class="project-modal-content">
            <h2>${project.title}</h2>
            <p class="project-description">${project.description}</p>
            
            <div class="project-details">
                <div class="project-tech-stack">
                    <h4>Tecnologias Utilizadas</h4>
                    <div class="tech-tags">
                        ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                    </div>
                </div>
                
                <div class="project-features">
                    <h4>Principais Funcionalidades</h4>
                    <ul>
                        ${project.features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            ${imagesHTML}
            ${videoHTML}
        </div>
    `;
    
    modal.style.display = 'block';
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

// Função para abrir modal de imagem (opcional)
function openImageModal(imageSrc) {
    const imageModal = document.createElement('div');
    imageModal.className = 'image-modal';
    imageModal.innerHTML = `
        <div class="image-modal-content">
            <span class="image-close">&times;</span>
            <img src="${imageSrc}" alt="Imagem do projeto">
        </div>
    `;
    
    document.body.appendChild(imageModal);
    
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal || e.target.classList.contains('image-close')) {
            document.body.removeChild(imageModal);
        }
    });
}

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