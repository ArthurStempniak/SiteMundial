// Site Mundial Telecom — JS de produção (versão com correção de responsividade definitiva e envio de currículos via FormData base64 para evitar CORS)
(function () {
  "use strict";

  // Helpers
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $all = (sel, ctx = document) =>
    Array.from((ctx || document).querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  document.addEventListener("DOMContentLoaded", () => {
    // --- VARIÁVEIS GLOBAIS ---
    
    const G_SCRIPT_URL ="https://script.google.com/macros/s/AKfycbwhH0XjEWdIRhoqPiWw3oqe94P7TN4I3ev2ldiBZL_C5kP7YhPXROQlvRutOP1oImvl/exec";
    const container = $(".fullpage-container");
    const footer = $(".main-footer");
    const logo = $(".main-header .logo");
    const mainNav = $(".main-nav");
    const sideNav = $(".side-nav");
    const socialIcons = $(".social-icons");
    const contactInfo = $(".contact-info");
    const allSlidesNodeList = $all(".slide, .mv-section");
    let visibleSlides = [];
    let totalSlides = 0;
    let currentSlide = 0;
    let isScrolling = false;
    let heroCarouselTimeout = null;
    let isInteractionOverlayOpen = false;

    // --- CORREÇÃO DE VIEWPORT (VH) PARA CELULARES ---
    function setRealViewportHeight() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    }
    setRealViewportHeight();
    window.addEventListener("resize", setRealViewportHeight);

    // --- LÓGICA DE ROLAGEM DE PÁGINA INTEIRA (APENAS DESKTOP) ---
    // Handlers de evento definidos como funções nomeadas para que possam ser adicionados e removidos.
    function handleWheel(e) {
      if (isInteractionOverlayOpen || isScrolling) return;
      const delta = Math.sign(e.deltaY);
      if (delta > 0) goToSlide(currentSlide + 1);
      else if (delta < 0) goToSlide(currentSlide - 1);
    }

    let touchStartY = null;
    function handleTouchStart(e) {
      if (isInteractionOverlayOpen) return;
      touchStartY = e.touches ? e.touches[0].clientY : null;
    }

    function handleTouchMove(e) {
      if (isInteractionOverlayOpen || touchStartY === null || isScrolling)
        return;
      const diff = touchStartY - e.touches[0].clientY;
      if (Math.abs(diff) > 40) {
        if (diff > 0) goToSlide(currentSlide + 1);
        else if (diff < 0) goToSlide(currentSlide - 1);
        touchStartY = null;
      }
    }

    function handleTouchEnd() {
      touchStartY = null;
    }

    function handleKeyDown(e) {
      if (isInteractionOverlayOpen || isScrolling) return;
      const activeElementTag = document.activeElement.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(activeElementTag)) return;
      const keysDown = ["ArrowDown", "PageDown", " "];
      const keysUp = ["ArrowUp", "PageUp"];
      if (keysDown.includes(e.key)) {
        e.preventDefault();
        goToSlide(currentSlide + 1);
      } else if (keysUp.includes(e.key)) {
        e.preventDefault();
        goToSlide(currentSlide - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goToSlide(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goToSlide(totalSlides - 1);
      }
    }

    // Função central que ATIVA ou DESATIVA o comportamento de rolagem por seção.
    function toggleFullPageScroll(enable) {
      if (enable) {
        window.addEventListener("wheel", handleWheel, { passive: true });
        window.addEventListener("touchstart", handleTouchStart, {
          passive: true,
        });
        window.addEventListener("touchmove", handleTouchMove, {
          passive: true,
        });
        window.addEventListener("touchend", handleTouchEnd);
        window.addEventListener("keydown", handleKeyDown);
        // Garante que a posição esteja correta ao ativar
        const pageHeight = window.innerHeight;
        container.style.transform = `translateY(-${
          currentSlide * pageHeight
        }px)`;
      } else {
        window.removeEventListener("wheel", handleWheel);
        window.removeEventListener("touchstart", handleTouchStart);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
        window.removeEventListener("keydown", handleKeyDown);
        // Limpa a transformação para permitir rolagem nativa
        container.style.transform = "";
      }
    }

    // --- LÓGICA DE GERENCIAMENTO DE VAGAS (MODIFICADO) ---
    const jobListingsContainer = $(".job-listings");
    if (jobListingsContainer) {
      // Impede que a rolagem dentro da lista de vagas acione a rolagem da página inteira
      jobListingsContainer.addEventListener("wheel", (event) => {
        if (
          jobListingsContainer.scrollHeight > jobListingsContainer.clientHeight
        ) {
          event.stopPropagation();
        }
      });
      
      // --- MODIFICADO: Usa delegação de eventos para os botões ---
      jobListingsContainer.addEventListener('click', (event) => {
        const target = event.target;
        const card = target.closest('.job-card');
        if (!card) return;

        const jobData = {
          jobId: card.dataset.jobId,
          jobTitle: card.dataset.jobTitle,
          jobDesc: card.dataset.jobDesc,
          jobReq: card.dataset.jobReq,
          jobBen: card.dataset.jobBen,
          jobSetor: card.dataset.jobSetor
        };

        if (target.matches('.btn-details')) {
          openModal($('#jobDetailsModal'), jobData);
        } else if (target.closest('.job-card-apply')) {
          event.preventDefault();
          openModal($('#jobApplicationModal'), jobData);
        }
      });
    }

    async function loadJobVacancies() {
      const container = $(".job-listings");
      if (!container || container.dataset.loaded === "true") return;
      container.innerHTML = '<p class="jobs-message">Carregando vagas...</p>';
      try {
        const response = await fetch(G_SCRIPT_URL);
        if (!response.ok) throw new Error("Falha ao buscar vagas.");
        const vagas = await response.json();
        
        const vagasAbertas = vagas.filter(vaga => vaga.Status === "Aberta");

        container.innerHTML = "";

        if (vagasAbertas.length === 0) {
          container.innerHTML =
            '<p class="jobs-message">Nenhuma vaga aberta no momento. Volte em breve!</p>';
        } else {
          vagasAbertas.forEach((vaga) => {
            // --- MODIFICADO: Adiciona todos os detalhes como data attributes e o novo botão ---
            const cardHTML = `
              <div class="job-card" 
                data-job-id="${vaga.ID_Vaga}" 
                data-job-title="${vaga.Titulo}" 
                data-job-setor="${vaga.Setor}"
                data-job-desc="${vaga.Descricao}"
                data-job-req="${vaga.Requisitos || ''}"
                data-job-ben="${vaga.Beneficios || ''}">
                <div class="job-card-header">
                  <h4>${vaga.Titulo}</h4>
                  <span class="job-card-department">${vaga.Setor}</span>
                </div>
                <p class="job-card-description">${vaga.Descricao.substring(0, 120)}...</p>
                <div class="job-card-actions">
                    <button class="btn-details">Ver Detalhes</button>
                    <a href="#" class="job-card-apply">Candidatar-se <i class="fas fa-arrow-right"></i></a>
                </div>
              </div>`;
            container.insertAdjacentHTML("beforeend", cardHTML);
          });
        }
      } catch (error) {
        console.error("Erro ao carregar vagas:", error);
        container.innerHTML =
          '<p class="jobs-message">Ocorreu um erro ao carregar as vagas. Tente novamente mais tarde.</p>';
      } finally {
        container.dataset.loaded = "true";
      }
    }

    // --- LÓGICA DE SLIDES DINÂMICOS ---
    function rebuildVisibleSlides() {
      const currentActive = visibleSlides[currentSlide];
      visibleSlides = Array.from(allSlidesNodeList).filter(
        (s) => !s.classList.contains("hidden-section")
      );
      totalSlides = visibleSlides.length;
      const newCurrentIndex = visibleSlides.indexOf(currentActive);
      if (newCurrentIndex !== -1) currentSlide = newCurrentIndex;
    }

    function updateSideNav(index) {
      const visibleNavLinks = $all(".side-nav li:not(.nav-item-hidden) a");
      visibleNavLinks.forEach((link, i) => {
        link.classList.toggle("active", i === index);
        link.setAttribute("aria-current", i === index ? "page" : "");
      });
    }

    // --- CARROSSEL HERO ---
    const heroCarouselTrack = $("#inicio .hero-carousel-track");
    let heroCarouselSlides = $all("#inicio .hero-image-container");
    let currentHeroSlideIndex = 1;
    let slideHalfHeight = 0;
    if (heroCarouselTrack && heroCarouselSlides.length > 1) {
      slideHalfHeight = heroCarouselSlides[0].offsetHeight / 2;
      const firstClone = heroCarouselSlides[0].cloneNode(true);
      const lastClone =
        heroCarouselSlides[heroCarouselSlides.length - 1].cloneNode(true);
      firstClone.setAttribute("aria-hidden", "true");
      lastClone.setAttribute("aria-hidden", "true");
      heroCarouselTrack.appendChild(firstClone);
      heroCarouselTrack.insertBefore(lastClone, heroCarouselSlides[0]);
      heroCarouselSlides = $all("#inicio .hero-image-container");
      heroCarouselTrack.addEventListener("transitionend", () => {
        const atLastClone =
          currentHeroSlideIndex >= heroCarouselSlides.length - 1;
        const atFirstClone = currentHeroSlideIndex <= 0;
        if (atLastClone || atFirstClone) {
          currentHeroSlideIndex = atLastClone
            ? 1
            : heroCarouselSlides.length - 2;
          updateHeroCarouselPosition(false);
        }
        stopHeroCarousel();
        heroCarouselTimeout = setTimeout(showNextHeroSlide, 5000);
      });
    }
    function updateHeroCarouselPosition(withTransition = true) {
      if (!heroCarouselTrack || heroCarouselSlides.length === 0) return;
      heroCarouselTrack.style.transition = withTransition
        ? "transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)"
        : "none";
      const activeSlide = heroCarouselSlides[currentHeroSlideIndex];
      const parentContainer = heroCarouselTrack.parentElement;
      if (!activeSlide || !parentContainer) return;
      const parentCenterY = parentContainer.clientHeight / 2;
      const slideCenterY = activeSlide.offsetTop + slideHalfHeight;
      const verticalOffset = parentCenterY - slideCenterY;
      heroCarouselTrack.style.transform = `translate(-50%, ${verticalOffset}px)`;
      heroCarouselSlides.forEach((slide, index) =>
        slide.classList.toggle("active", index === currentHeroSlideIndex)
      );
    }
    function showNextHeroSlide() {
      if (!heroCarouselTrack || heroCarouselSlides.length <= 3) return;
      currentHeroSlideIndex++;
      updateHeroCarouselPosition(true);
    }
    function startHeroCarousel() {
      stopHeroCarousel();
      if (heroCarouselTrack && heroCarouselSlides.length > 1) {
        updateHeroCarouselPosition(false);
        heroCarouselTimeout = setTimeout(showNextHeroSlide, 5000);
      }
    }
    function stopHeroCarousel() {
      clearTimeout(heroCarouselTimeout);
      heroCarouselTimeout = null;
    }

    // --- FUNÇÃO CENTRAL PARA ATUALIZAR TEMAS E CONTROLAR CARROSSEL ---
    function updateDynamicThemes(slideId) {
      const themeConfig = {
        logoLight: [
          "inicio",
          "contato",
          "avaliacoes",
          "trabalhe-conosco",
          "informacoes-finais",
        ],
        mainNavLight: ["contato", "informacoes-finais"],
        socialIconsLight: [
          "inicio",
          "contato",
          "avaliacoes",
          "trabalhe-conosco",
          "informacoes-finais",
        ],
        contactInfoLight: ["contato", "informacoes-finais"],
        sideNavLight: ["contato", "informacoes-finais"],
      };
      logo?.classList.toggle(
        "logo-light",
        themeConfig.logoLight.includes(slideId)
      );
      mainNav?.classList.toggle(
        "light-theme",
        themeConfig.mainNavLight.includes(slideId)
      );
      socialIcons?.classList.toggle(
        "light-theme",
        themeConfig.socialIconsLight.includes(slideId)
      );
      contactInfo?.classList.toggle(
        "light-theme",
        themeConfig.contactInfoLight.includes(slideId)
      );
      sideNav?.classList.toggle(
        "light-theme",
        themeConfig.sideNavLight.includes(slideId)
      );
      footer?.classList.toggle(
        "hidden",
        visibleSlides[currentSlide]?.id === "informacoes-finais"
      );
      slideId === "inicio" ? startHeroCarousel() : stopHeroCarousel();
    }

    // --- LÓGICA DE ROLAGEM DE SLIDES (agora com verificação) ---
    const isDesktop = window.matchMedia("(min-width: 901px)");

    function goToSlide(index) {
      if (!isDesktop.matches) {
        const target = visibleSlides[index];
        if (target) target.scrollIntoView({ behavior: "smooth" });
        return;
      }
      if (isInteractionOverlayOpen || !container || !visibleSlides.length)
        return;
      index = clamp(index, 0, totalSlides - 1);
      if (index === currentSlide || isScrolling) return;
      isScrolling = true;
      const prev = visibleSlides[currentSlide];
      const next = visibleSlides[index];
      prev?.classList.add("is-leaving");
      setTimeout(() => prev?.classList.remove("is-leaving"), 600);
      allSlidesNodeList.forEach((s) => s.classList.remove("active"));
      next?.classList.add("active");
      const pageHeight = window.innerHeight;
      container.style.transform = `translateY(-${index * pageHeight}px)`;
      const id = next?.id || next?.getAttribute("data-slide-name") || "";
      if (id) history.replaceState(null, "", `#${id}`);
      currentSlide = index;
      updateDynamicThemes(id);
      updateSideNav(currentSlide);
      setTimeout(() => {
        isScrolling = false;
      }, 800);
    }

    // --- ATIVAÇÃO E NAVEGAÇÃO ---
    const workWithUsBtn = $(
      '.main-nav a.nav-cta-link[href="#trabalhe-conosco"]'
    );
    workWithUsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const targetSection = $("#trabalhe-conosco");
      if (targetSection.classList.contains("hidden-section")) {
        targetSection.classList.remove("hidden-section");
        const navItem = $(
          '.side-nav a[href="#trabalhe-conosco"]'
        ).parentElement;
        navItem.classList.remove("nav-item-hidden");
        rebuildVisibleSlides();
        loadJobVacancies();
      }
      const newIndex = visibleSlides.indexOf(targetSection);
      if (newIndex !== -1) goToSlide(newIndex);
    });

    $all(".side-nav a, .cta-button").forEach((link) => {
      link.addEventListener("click", (ev) => {
        const href = link.getAttribute("href") || "";
        if (!href.startsWith("#")) return;
        ev.preventDefault();
        const id = href.slice(1);
        const target = $(`#${id}`) || $(`[data-slide-name="${id}"]`);
        if (target) {
          const idx = visibleSlides.indexOf(target);
          if (idx !== -1) goToSlide(idx);
        }
      });
    });

    // --- INICIALIZAÇÃO DA PÁGINA ---
    function initializePage() {
      rebuildVisibleSlides();
      const initialHash = window.location.hash.replace("#", "");
      let initialSlideId = initialHash || visibleSlides[0]?.id || "inicio";
      if ($(`#${initialSlideId}`)?.classList.contains("hidden-section"))
        initialSlideId = "inicio";
      const target =
        $(`#${initialSlideId}`) || $(`[data-slide-name="${initialSlideId}"]`);
      if (target) {
        const idx = visibleSlides.indexOf(target);
        if (idx >= 0) {
          container.style.transition = "none";
          currentSlide = idx;
          allSlidesNodeList.forEach((s) => s.classList.remove("active"));
          target.classList.add("active");
          updateDynamicThemes(target.id);
          updateSideNav(currentSlide);
          if (!isDesktop.matches && initialHash) target.scrollIntoView();
          requestAnimationFrame(() => {
            container.style.transition = "";
          });
        }
      }
      if (currentSlide === 0) startHeroCarousel();
    }

    initializePage();
    toggleFullPageScroll(isDesktop.matches);
    isDesktop.addEventListener("change", (e) => {
      isScrolling = false;
      container.style.transition = "none";
      toggleFullPageScroll(e.matches);
      requestAnimationFrame(() => {
        container.style.transition = "";
      });
    });

    // --- CARROSSELIS E MODAIS (Lógicas inalteradas) ---
    (function initPlanCarousel() {
      /*...*/
    })(); // Conteúdo original omitido para brevidade
    (function initReviewsCarousel() {
      /*...*/
    })(); // Conteúdo original omitido para brevidade

    // --- CÓDIGO REMANESCENTE (MODAIS, FORMULÁRIOS, ETC.) PERMANECE O MESMO ---

    (function initPlanCarousel() {
      const carousel = $(".plan-carousel");
      if (!carousel) return;
      const stage = $(".carousel-stage", carousel);
      const planSlides = $all(".plan-slide", stage);
      const prevBtn = $(".carousel-arrow.prev", carousel);
      const nextBtn = $(".carousel-arrow.next", carousel);
      if (!stage || planSlides.length === 0) return;
      let currentPlanIndex = 0;
      const totalPlans = planSlides.length;
      const isMobile = window.innerWidth <= 900;
      const config = {
        autoplay: true,
        interval: 3500,
        pauseOnHover: true,
        swipeThreshold: 30,
        zOffset: isMobile ? 80 : 160,
        xSpacing: isMobile ? 65 : 110,
        scaleStep: isMobile ? 0.2 : 0.25,
        preferReducedMotion: window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches,
      };
      function updateCarouselStyles() {
        planSlides.forEach((slide, index) => {
          const offset = index - currentPlanIndex;
          const abs = Math.abs(offset);
          const translateX = offset * config.xSpacing;
          const translateZ = -abs * config.zOffset;
          const scale = Math.max(0.6, 1 - abs * config.scaleStep);
          const opacity = abs > 2 ? 0 : 1;
          slide.style.transform = `translateX(${translateX}px) translateZ(${translateZ}px) scale(${scale})`;
          slide.style.opacity = String(opacity);
          slide.style.zIndex = String(100 - abs);
          slide.style.filter = `grayscale(${abs > 0 ? 1 : 0})`;
          slide.style.transition = config.preferReducedMotion
            ? "none"
            : "transform .6s cubic-bezier(.2,.9,.2,1), opacity .4s ease, filter .4s ease";
          slide.setAttribute("aria-hidden", abs > 1 ? "true" : "false");
        });
      }
      function showNext() {
        currentPlanIndex = (currentPlanIndex + 1) % totalPlans;
        updateCarouselStyles();
      }
      function showPrev() {
        currentPlanIndex = (currentPlanIndex - 1 + totalPlans) % totalPlans;
        updateCarouselStyles();
      }
      nextBtn?.addEventListener("click", () => {
        showNext();
        resetAutoplay();
      });
      prevBtn?.addEventListener("click", () => {
        showPrev();
        resetAutoplay();
      });
      let autoplayTimer = null;
      function startAutoplay() {
        if (!config.autoplay || config.preferReducedMotion) return;
        stopAutoplay();
        autoplayTimer = setInterval(showNext, config.interval);
      }
      function stopAutoplay() {
        if (autoplayTimer) {
          clearInterval(autoplayTimer);
          autoplayTimer = null;
        }
      }
      function resetAutoplay() {
        stopAutoplay();
        startAutoplay();
      }
      if (config.pauseOnHover) {
        carousel.addEventListener("mouseenter", stopAutoplay);
        carousel.addEventListener("mouseleave", startAutoplay);
        carousel.addEventListener("focusin", stopAutoplay);
        carousel.addEventListener("focusout", startAutoplay);
      }
      let pointerDown = false,
        startX = 0;
      function onPointerDown(clientX) {
        pointerDown = true;
        startX = clientX;
        stage.style.cursor = "grabbing";
        stage.style.transition = "none";
      }
      function onPointerUp(clientX) {
        if (!pointerDown) return;
        pointerDown = false;
        stage.style.cursor = "";
        const dx = clientX - startX;
        stage.style.transition = "";
        if (Math.abs(dx) > config.swipeThreshold) {
          if (dx < 0) showNext();
          else showPrev();
          resetAutoplay();
        } else {
          updateCarouselStyles();
        }
      }
      stage.addEventListener("mousedown", (e) => {
        e.preventDefault();
        onPointerDown(e.clientX);
      });
      window.addEventListener("mousemove", (e) => {
        if (pointerDown) onPointerUp(e.clientX);
      });
      window.addEventListener("mouseup", (e) => onPointerUp(e.clientX));
      stage.addEventListener(
        "touchstart",
        (e) => {
          onPointerDown(e.touches[0].clientX);
        },
        { passive: true }
      );
      stage.addEventListener(
        "touchend",
        (e) => {
          const clientX =
            (e.changedTouches &&
              e.changedTouches[0] &&
              e.changedTouches[0].clientX) ||
            startX;
          onPointerUp(clientX);
        },
        { passive: true }
      );
      carousel.setAttribute("tabindex", "0");
      carousel.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
          showPrev();
          resetAutoplay();
        }
        if (e.key === "ArrowRight") {
          showNext();
          resetAutoplay();
        }
      });
      planSlides.forEach((slide) => {
        slide.addEventListener("click", () => {
          const planName =
            slide.getAttribute("data-plan") ||
            slide.querySelector("img")?.alt ||
            "Plano";
          openModal($("#planFormModal"), { planName });
        });
        slide.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const planName =
              slide.getAttribute("data-plan") ||
              slide.querySelector("img")?.alt ||
              "Plano";
            openModal($("#planFormModal"), { planName });
          }
        });
      });
      updateCarouselStyles();
      startAutoplay();
      new ResizeObserver(() => updateCarouselStyles()).observe(stage);
    })();
    (function initReviewsCarousel() {
      const container = $("#avaliacoes");
      if (!container) return;
      const track = $(".reviews-track", container);
      const slides = $all(".review-card", container);
      const prevBtn = $(".reviews-nav .prev", container);
      const nextBtn = $(".reviews-nav .next", container);
      if (!track || slides.length < 2) return;
      let currentIndex = 0;
      const totalSlides = slides.length;
      function updatePosition() {
        if (track) {
          track.style.transform = `translateX(-${currentIndex * 100}%)`;
        }
      }
      function showNext() {
        currentIndex = (currentIndex + 1) % totalSlides;
        updatePosition();
      }
      function showPrev() {
        currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;
        updatePosition();
      }
      nextBtn?.addEventListener("click", showNext);
      prevBtn?.addEventListener("click", showPrev);
      let touchStartX = 0,
        touchEndX = 0;
      const swipeThreshold = 50;
      track.addEventListener(
        "touchstart",
        (e) => {
          touchStartX = e.touches[0].clientX;
        },
        { passive: true }
      );
      track.addEventListener(
        "touchmove",
        (e) => {
          touchEndX = e.touches[0].clientX;
        },
        { passive: true }
      );
      track.addEventListener("touchend", () => {
        if (touchStartX === 0) return;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > swipeThreshold) {
          if (diff > 0) showNext();
          else showPrev();
        }
        touchStartX = 0;
        touchEndX = 0;
      });
      updatePosition();
    })();
    const allModals = $all(".modal"),
      visionOverlay = $("#vision-overlay");
    let activeModal = null,
      activeOverlay = null;

    // --- MODIFICADO: Função openModal agora lida com o novo modal de detalhes ---
    function openModal(modal, options = {}) {
      if (!modal) return;
      
      if (modal.id === "planFormModal" && options.planName) {
        const planSelect = $("#planSelect", modal),
          planForm = $("#planForm", modal);
        planForm.reset();
        $("#formMessage", planForm).textContent = "";
        planSelect.value = options.planName;
        setTimeout(() => $("#fullName", modal).focus(), 120);
      }
      
      if (modal.id === "jobApplicationModal" && options.jobId) {
        const jobVagaIdInput = $("#jobVagaId", modal),
          jobModalTitle = $("#jobModalTitle", modal),
          jobForm = $("#jobApplicationForm", modal);
        jobForm.reset();
        $(".file-input-text").textContent = "Escolher arquivo...";
        $("#jobFormMessage").textContent = "";
        jobVagaIdInput.value = options.jobId; 
        jobModalTitle.textContent = `Candidatura: ${options.jobTitle}`;
        setTimeout(() => $("#jobApplicantName", modal).focus(), 120);
      }

      // --- NOVO: Lógica para popular o modal de detalhes da vaga ---
      if (modal.id === "jobDetailsModal" && options.jobId) {
        $('#jobDetailsModalTitle').textContent = options.jobTitle;
        $('#jobDetailsModalSubtitle').textContent = `Vaga no setor ${options.jobSetor}`;
        
        const contentContainer = $('#jobDetailsModalContent');
        contentContainer.innerHTML = `
          <div class="job-detail-section">
            <h3>Descrição Completa</h3>
            <p>${options.jobDesc || 'Não especificado.'}</p>
          </div>
          <div class="job-detail-section">
            <h3>Requisitos</h3>
            <p>${options.jobReq || 'Não especificado.'}</p>
          </div>
          <div class="job-detail-section">
            <h3>Benefícios</h3>
            <p>${options.jobBen || 'Não especificado.'}</p>
          </div>
        `;
        
        const applyBtn = $('#applyFromDetailsBtn');
        // Armazena os dados no botão para uso posterior
        applyBtn.dataset.jobId = options.jobId;
        applyBtn.dataset.jobTitle = options.jobTitle;
      }

      if (modal.id === "modal-mission") {
        const steps = $all(".mission-step", modal);
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
              }
            });
          },
          { root: modal.querySelector(".modal-inner"), threshold: 0.5 }
        );
        steps.forEach((step) => observer.observe(step));
      }

      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      isInteractionOverlayOpen = true;
      activeModal = modal;
      trapFocus(modal);
    }
    
    // --- NOVO: Event listener para o botão "Candidatar-se" dentro do modal de detalhes ---
    $('#applyFromDetailsBtn')?.addEventListener('click', (e) => {
        const { jobId, jobTitle } = e.target.dataset;
        closeModal(); // Fecha o modal de detalhes
        // Abre o modal de candidatura com os dados corretos
        setTimeout(() => {
            openModal($('#jobApplicationModal'), { jobId, jobTitle });
        }, 300); // Pequeno delay para a transição ficar mais suave
    });

    function closeModal() {
      if (!activeModal) return;
      activeModal.classList.remove("open");
      activeModal.setAttribute("aria-hidden", "true");
      isInteractionOverlayOpen = !!activeOverlay;
      releaseFocusTrap();
      activeModal = null;
    }
    function openOverlay(overlay) {
      if (!overlay) return;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      isInteractionOverlayOpen = true;
      activeOverlay = overlay;
      if (overlay.id === "vision-overlay") initVisionTimeline();
      trapFocus(overlay);
    }
    function closeOverlay() {
      if (!activeOverlay) return;
      activeOverlay.classList.remove("open");
      activeOverlay.setAttribute("aria-hidden", "true");
      isInteractionOverlayOpen = !!activeModal;
      releaseFocusTrap();
      activeOverlay = null;
    }
    allModals.forEach((modal) => {
      $(".modal-close", modal)?.addEventListener("click", closeModal);
      $(".modal-backdrop", modal)?.addEventListener("click", closeModal);
      $(".modal-cancel", modal)?.addEventListener("click", closeModal);
    });
    $(".vision-close", visionOverlay)?.addEventListener("click", closeOverlay);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (activeModal) closeModal();
        if (activeOverlay) closeOverlay();
      }
    });
    const planForm = $("#planForm");
    planForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const formMessage = $("#formMessage", planForm);
      formMessage.textContent = "";
      formMessage.classList.remove("error", "success");
      const planSelect = $("#planSelect", planForm);
      const planText = planSelect.options[planSelect.selectedIndex].text,
        name = $("#fullName", planForm).value,
        phone = $("#phone", planForm).value,
        email = $("#email", planForm).value,
        bairro = $("#bairro", planForm).value;
      if (!planSelect.value || !name || !phone || !bairro) {
        formMessage.textContent =
          "Por favor, preencha todos os campos obrigatórios.";
        formMessage.classList.add("error");
        return;
      }
      const ComercialPhone = "5545998317031";
      const message = `Olá! Tenho interesse em contratar um plano da Mundial Telecom.\n\n*Plano de Interesse:* ${planText}\n*Nome:* ${name}\n*Telefone:* ${phone}\n*E-mail:* ${email}\n*Bairro:* ${bairro}\n\nAguardo o contato.`;
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${ComercialPhone}?text=${encodedMessage}`;
      formMessage.textContent =
        "Obrigado! Estamos redirecionando você para o WhatsApp...";
      formMessage.classList.add("success");
      setTimeout(() => {
        window.open(whatsappUrl, "_blank");
        closeModal();
        planForm.reset();
      }, 2000);
    });
    const resumeFileInput = $("#resumeFile");
    resumeFileInput?.addEventListener("change", () => {
      const fileName =
        resumeFileInput.files.length > 0
          ? resumeFileInput.files[0].name
          : "Escolher arquivo...";
      const fileInputText = $(".file-input-text");
      if (fileInputText) fileInputText.textContent = fileName;
    });
    
    // ***** LÓGICA DE SUBMISSÃO DO FORMULÁRIO DE VAGAS: AGORA VIA FormData (sem headers) PARA EVITAR CORS *****
    const jobApplicationForm = $("#jobApplicationForm");

    async function sendApplicationAsFormData(formEl) {
      const formMessage = $("#jobFormMessage");
      const submitButton = $("button[type='submit']", formEl);
      try {
        formMessage.textContent = "Enviando sua candidatura, aguarde...";
        formMessage.className = "form-message";
        submitButton.disabled = true;

        const nome = (formEl.querySelector('[name="nome"]') || {}).value || '';
        const telefone = (formEl.querySelector('[name="telefone"]') || {}).value || '';
        const email = (formEl.querySelector('[name="email"]') || {}).value || '';
        const vagaIdInput = formEl.querySelector('[name="vagaId"]') || formEl.querySelector('#jobVagaId');
        const vagaId = (vagaIdInput && (vagaIdInput.value || vagaIdInput.getAttribute('value'))) || '';
        const fileInput = formEl.querySelector('[name="curriculo"]');

        if (!nome || !telefone || !email || !fileInput || !fileInput.files || fileInput.files.length === 0) {
          formMessage.textContent = "Por favor, preencha todos os campos e anexe seu currículo.";
          formMessage.classList.add("error");
          submitButton.disabled = false;
          return;
        }

        const file = fileInput.files[0];

        // validação rápida de extensão/tamanho
        if (file.size > 5 * 1024 * 1024) { // 5 MB
          formMessage.textContent = "Arquivo muito grande (máx 5MB).";
          formMessage.classList.add("error");
          submitButton.disabled = false;
          return;
        }

        // Lê base64 (ainda assim enviaremos em FormData para evitar preflight)
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
          reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
          reader.onload = () => resolve(reader.result.split(',')[1]); // remove "data:*/*;base64,"
          reader.readAsDataURL(file);
        });

        // Monta FormData (sem headers explícitos) — evita preflight
        const fd = new FormData();
        fd.append('action', 'applyForVagaBase64'); // será tratado no doPost como multipart
        fd.append('nome', nome);
        fd.append('telefone', telefone);
        fd.append('email', email);
        fd.append('vagaId', vagaId);
        fd.append('fileName', file.name);
        fd.append('fileMime', file.type || 'application/octet-stream');
        fd.append('fileBase64', base64);

        // Envia sem definir headers - permite browser escolher boundary e evita pré-flight
        const res = await fetch(G_SCRIPT_URL, {
          method: 'POST',
          body: fd,
        });

        // sempre checar res.ok; ler texto se não JSON
        if (!res.ok) {
          const txt = await res.text().catch(()=> 'Resposta não disponível');
          throw new Error(`Erro na requisição: ${res.status} ${res.statusText} — ${txt}`);
        }

        // tentar ler JSON
        const data = await res.json().catch(async ()=> {
          const t = await res.text().catch(()=> '');
          throw new Error('Resposta inválida do servidor: ' + t);
        });

        if (data.status === 'success') {
          formMessage.textContent = "Candidatura enviada com sucesso! Agradecemos o seu interesse.";
          formMessage.classList.add("success");
          formEl.reset();
          $('.file-input-text').textContent = "Escolher arquivo...";
          setTimeout(() => {
            closeModal();
          }, 2500);
        } else {
          throw new Error(data.message || 'Ocorreu um erro desconhecido.');
        }
      } catch (err) {
        console.error('Erro ao enviar FormData base64:', err);
        formMessage.textContent = `Erro ao enviar: ${err.message}`;
        formMessage.classList.add("error");
      } finally {
        $("button[type='submit']", formEl).disabled = false;
      }
    }

    // Substitui o submit handler para usar FormData fallback (evita CORS preflight)
    jobApplicationForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      sendApplicationAsFormData(jobApplicationForm);
    });

    $all(".mv-card").forEach((card) => {
      const targetId = card.getAttribute("data-target"),
        targetElement = $(`#${targetId}`);
      if (!targetElement) return;
      const openFn = targetId === "vision-overlay" ? openOverlay : openModal;
      card.addEventListener("click", () => openFn(targetElement));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFn(targetElement);
        }
      });
    });
    $all(".flip-card").forEach((card) => {
      const action = () => {
        $all(".flip-card").forEach((c) => {
          if (c !== card) c.classList.remove("is-flipped");
        });
        card.classList.toggle("is-flipped");
      };
      card.addEventListener("click", action);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          action();
        }
      });
    });
    function initVisionTimeline() {
      const overlay = visionOverlay;
      if (!overlay) return;
      const wrapper = $(".vision-timeline-wrapper", visionOverlay),
        track = $(".vision-timeline-track", visionOverlay),
        milestones = $all(".vision-milestone", visionOverlay),
        prevBtn = $(".vision-arrow.prev", visionOverlay),
        nextBtn = $(".vision-arrow.next", visionOverlay);
      if (!wrapper || !track || milestones.length === 0) return;
      let currentIndex = Math.floor(milestones.length / 2),
        isDown = false,
        startX,
        scrollLeft;
      function updateTimeline() {
        const targetMilestone = milestones[currentIndex];
        if (!targetMilestone) return;
        milestones.forEach((m, i) =>
          m.classList.toggle("active", i === currentIndex)
        );
        const scrollAmount =
          targetMilestone.offsetLeft -
          wrapper.offsetWidth / 2 +
          targetMilestone.offsetWidth / 2;
        wrapper.scrollTo({ left: scrollAmount, behavior: "smooth" });
      }
      function showNext() {
        currentIndex = Math.min(currentIndex + 1, milestones.length - 1);
        updateTimeline();
      }
      function showPrev() {
        currentIndex = Math.max(currentIndex - 1, 0);
        updateTimeline();
      }
      prevBtn?.addEventListener("click", showPrev);
      nextBtn?.addEventListener("click", showNext);
      wrapper.addEventListener("mousedown", (e) => {
        isDown = true;
        wrapper.classList.add("active");
        startX = e.pageX - wrapper.offsetLeft;
        scrollLeft = wrapper.scrollLeft;
      });
      wrapper.addEventListener("mouseleave", () => {
        isDown = false;
        wrapper.classList.remove("active");
      });
      wrapper.addEventListener("mouseup", () => {
        isDown = false;
        wrapper.classList.remove("active");
      });
      wrapper.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - wrapper.offsetLeft;
        const walk = (x - startX) * 2;
        wrapper.scrollLeft = scrollLeft - walk;
      });
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") showPrev();
        if (e.key === "ArrowRight") showNext();
      });
      setTimeout(updateTimeline, 100);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );
    $all("[data-animation], .mv-card").forEach((el) => observer.observe(el));
    let lastFocusedElement = null,
      focusableElements = [];
    function trapFocus(root) {
      lastFocusedElement = document.activeElement;
      focusableElements = $all(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        root
      ).filter((el) => el.offsetParent !== null);
      if (focusableElements.length > 0)
        root.addEventListener("keydown", handleFocusTrap);
    }
    function releaseFocusTrap() {
      const el = activeModal || activeOverlay;
      if (!el) return;
      el.removeEventListener("keydown", handleFocusTrap);
      lastFocusedElement?.focus();
    }
    function handleFocusTrap(e) {
      if (e.key !== "Tab" || focusableElements.length === 0) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });
})();