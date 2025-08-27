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
        description: 'Loja de roupas de comércio eletrônico construída com HTML, CSS, JavaScript, PHP e MySQL. Sistema completo de autenticação, carrinho de compras e gerenciamento de produtos.',
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
        description: 'Landing page para captura de leads com sistema modal inteligente. Design responsivo com backend PHP e integração com banco de dados MySQL.',
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
        description: 'Landing page para captura de leads com modal inteligente. Sistema de validação em tempo real, integração com WhatsApp e design responsivo.',
        technologies: ['HTML', 'CSS', 'JavaScript', 'PHP', 'MySQL'],
        images: ['Robo Vendedor web/1.png', 'Robo Vendedor web/2.png', 'Robo Vendedor web/3.png'],
        videoUrl: 'https://youtu.be/LXiqHN8r4xA'
    },
    'reforco-online': {
        title: 'Reforço Online',
        description: 'Plataforma completa que conecta alunos e professores para aulas de reforço escolar online. Sistema de chat em tempo real, dashboard para gestão de aulas, upload de materiais didáticos e controle de disponibilidade. Interface com React e TypeScript, backend PHP com APIs RESTful e banco MySQL.',
        technologies: ['React', 'TypeScript', 'PHP', 'MySQL', 'CSS3', 'JavaScript'],
        images: ['Reforço Online/1.png', 'Reforço Online/2.png', 'Reforço Online/3.png', 'Reforço Online/4.png', 'Reforço Online/5.png', 'Reforço Online/6.png', 'Reforço Online/7.png', 'Reforço Online/8.png', 'Reforço Online/9.png', 'Reforço Online/10.png', 'Reforço Online/11.png', 'Reforço Online/12.png', 'Reforço Online/13.png', 'Reforço Online/14.png', 'Reforço Online/15.png', 'Reforço Online/16.png', 'Reforço Online/17.png', 'Reforço Online/18.png'],
        videoUrl: 'https://youtu.be/GWz9RJ-Kx9U'
    },
    'conversor-de-moedas-mobile': {
        title: 'Conversor de Moedas Mobile',
        description: 'Aplicativo React Native para conversão de moedas em tempo real com 150+ moedas. Interface moderna com design dark mode, taxas atualizadas via API e sistema de fallback para funcionamento offline.',
        technologies: ['React Native', 'Expo', 'TypeScript', 'API AwesomeAPI'],
        images: ['Conversor de Moedas Mobile/1.jfif', 'Conversor de Moedas Mobile/2.jfif', 'Conversor de Moedas Mobile/3.jfif'],
        videoUrl: 'https://youtube.com/shorts/vh_sg01Gp3M'
    },
    'fit-21-dias': {
        title: 'Projeto 21 Fit Dias',
        description: 'Plataforma de transformação física com resultados comprovados em 21 dias. Sistema de acompanhamento visual com fotos antes/depois, métricas de progresso, cronograma estruturado e interface responsiva moderna.',
        technologies: ['React', 'TypeScript', 'Node.js', 'MySQL', 'HTML5', 'CSS3', 'JavaScript'],
        images: ['Projeto Fit 21 Dias/1.png', 'Projeto Fit 21 Dias/2.png', 'Projeto Fit 21 Dias/3.png', 'Projeto Fit 21 Dias/5.png', 'Projeto Fit 21 Dias/6.png', 'Projeto Fit 21 Dias/7.png', 'Projeto Fit 21 Dias/8.png', 'Projeto Fit 21 Dias/9.png', 'Projeto Fit 21 Dias/10.png', 'Projeto Fit 21 Dias/11.png', 'Projeto Fit 21 Dias/12.png', 'Projeto Fit 21 Dias/13.png'],
        videoUrl: 'https://youtu.be/HbrZEmRxAcM'
    },
    'biblioteca-digital': {
        title: 'Biblioteca Digital',
        description: 'Aplicativo móvel completo para download de livros em PDF. Backend Node.js com Express e MySQL, frontend React Native com Expo. Sistema de autenticação JWT, busca de livros, downloads e interface mobile responsiva para Android e iOS.',
        technologies: ['React Native', 'Expo', 'TypeScript', 'Node.js', 'Express', 'MySQL', 'JWT'],
        images: ['Biblioteca Digital/1.png', 'Biblioteca Digital/2.png', 'Biblioteca Digital/3.png', 'Biblioteca Digital/4.png', 'Biblioteca Digital/5.png', 'Biblioteca Digital/6.png', 'Biblioteca Digital/7.png', 'Biblioteca Digital/8.png', 'Biblioteca Digital/9.png', 'Biblioteca Digital/10.png', 'Biblioteca Digital/11.png', 'Biblioteca Digital/12.png'],
        videoUrl: 'https://youtu.be/kkfoxrcMs-E'
    },
    'primecar': {
        title: 'PrimeCar',
        description: 'Plataforma completa de marketplace automotivo desenvolvida em React.js e Node.js. Sistema de anúncios com upload de imagens, filtros avançados de busca, chat em tempo real com Socket.io, painel administrativo e autenticação JWT. Ideal para concessionárias e plataformas de compra e venda de veículos.',
        technologies: ['React.js', 'Node.js', 'Express', 'Socket.io', 'SQLite', 'JWT', 'Multer'],
        images: ['PrimeCar/1.png', 'PrimeCar/2.png', 'PrimeCar/3.png', 'PrimeCar/4.png', 'PrimeCar/5.png', 'PrimeCar/6.png', 'PrimeCar/7.png', 'PrimeCar/8.png', 'PrimeCar/9.png', 'PrimeCar/10.png'],
        videoUrl: 'https://youtu.be/pngSHrCa5Ik'
    },
    'sistema-avaliacao-seguranca': {
        title: 'Sistema de Avaliação de Segurança',
        description: 'Sistema web completo e profissional para avaliação de segurança cibernética baseado no framework NIST. Desenvolvido para empresas de consultoria em cibersegurança, transforma questionários manuais em planilhas em uma plataforma digital automatizada. Inclui frontend responsivo para clientes, painel administrativo completo, sistema de relatórios em PDF/DOCX e dashboards analíticos.',
        technologies: ['PHP', 'MySQL', 'JavaScript', 'Node.js', 'Puppeteer', 'PhpWord', 'Chart.js'],
        images: ['Sistema de Avaliacao de Seguranca/1.png', 'Sistema de Avaliacao de Seguranca/2.png', 'Sistema de Avaliacao de Seguranca/3.png', 'Sistema de Avaliacao de Seguranca/4.png', 'Sistema de Avaliacao de Seguranca/5.png', 'Sistema de Avaliacao de Seguranca/6.png', 'Sistema de Avaliacao de Seguranca/7.png', 'Sistema de Avaliacao de Seguranca/8.png', 'Sistema de Avaliacao de Seguranca/9.png'],
        videoUrl: 'https://youtu.be/Uuh5snwewJI'
    }
};

// Função para extrair ID do YouTube da URL
function extractYouTubeId(url) {
    // Suporte para URLs de Shorts do YouTube
    if (url.includes('/shorts/')) {
        const shortsMatch = url.match(/\/shorts\/([^\/\?]+)/);
        return shortsMatch ? shortsMatch[1] : null;
    }
    
    // Suporte para URLs normais do YouTube
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
        header.style.background = 'rgba(10, 10, 10, 0.99)';
        header.style.borderBottom = '1px solid #3b82f6';
    } else {
        header.style.background = 'rgba(10, 10, 10, 0.95)';
        header.style.borderBottom = '1px solid #1f2937';
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