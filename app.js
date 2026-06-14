(() => {
   "use strict";

   const CONFIG = {
      menuUrl: "dati/menu.json",
      copertoUnitario: 1
   };

   const state = {
      menu: [],
      categorie: [],
      ordine: {},
      cliente: {
         nomecliente: "",
         tavolo: "",
         coperti: 0
      }
   };

   const $ = (selector) => document.querySelector(selector);
   const $$ = (selector) => Array.from(document.querySelectorAll(selector));

   document.addEventListener("DOMContentLoaded", init);

   async function init() {
      try {
         await loadMenu();
         renderMenu();
         bindEvents();
         showPage("page-menu");
      } catch (error) {
         console.error("Errore nel caricamento del menu:", error);
         showToast("Errore nel caricamento del menu");
      }
   }

   async function loadMenu() {
      const response = await fetch(CONFIG.menuUrl, { cache: "no-store" });
      if (!response.ok) {
         throw new Error(`Menu non caricato: ${response.status}`);
      }

      const rawMenu = await response.json();

      state.menu = rawMenu
         .filter(item => item && item.id != null && item.piatto && item.categoria)
         .map(item => ({
            id: Number(item.id),
            nome: String(item.piatto).trim(),
            categoria: String(item.categoria).trim(),
            prezzo: Number(item.prezzo) || 0
         }));

      state.categorie = [...new Set(state.menu.map(item => item.categoria))];
   }

   function bindEvents() {
      $("#menu-container").addEventListener("click", handleMenuClick);
      $("#resoconto-btn").addEventListener("click", goToRiepilogo);
      $("#elimina-ordine-btn").addEventListener("click", resetOrdineConferma);
      $("#modifica-btn").addEventListener("click", () => showPage("page-menu"));
      $("#conferma-btn").addEventListener("click", goToQr);
      $("#nuovo-ordine-btn").addEventListener("click", nuovoOrdine);
   }

   function showPage(pageId) {
      $$(".page").forEach(page => page.classList.remove("is-active"));
      const page = document.getElementById(pageId);
      if (page) page.classList.add("is-active");
      window.scrollTo({ top: 0, behavior: "instant" });
   }

   function renderMenu() {
      const container = $("#menu-container");
      container.innerHTML = "";

      state.categorie.forEach((categoria, index) => {
         const section = document.createElement("section");
         section.className = "category";
         section.dataset.category = categoria;

         const button = document.createElement("button");
         button.type = "button";
         button.className = "category-toggle";
         button.textContent = categoria;

         const content = document.createElement("div");
         content.className = "category-content";

         const piatti = state.menu.filter(item => item.categoria === categoria);

         piatti.forEach(piatto => {
            content.appendChild(createDishRow(piatto));
         });

         section.appendChild(button);
         section.appendChild(content);
         container.appendChild(section);

         if (index === 0) {
            section.classList.add("is-open");
         }
      });

      updateAllQuantities();
   }

   function createDishRow(piatto) {
      const row = document.createElement("article");
      row.className = "dish-row";
      row.dataset.id = String(piatto.id);

      row.innerHTML = `
         <div>
            <div class="dish-name">${escapeHtml(piatto.nome)}</div>
            <div class="dish-price">${formatEuro(piatto.prezzo)}</div>
         </div>
         <div class="qty-control">
            <button type="button" class="qty-btn minus" data-action="minus" data-id="${piatto.id}" aria-label="Diminuisci ${escapeHtml(piatto.nome)}">−</button>
            <span class="qty" id="qty-${piatto.id}">0</span>
            <button type="button" class="qty-btn plus" data-action="plus" data-id="${piatto.id}" aria-label="Aumenta ${escapeHtml(piatto.nome)}">+</button>
         </div>
      `;

      return row;
   }

   function handleMenuClick(event) {
      const toggle = event.target.closest(".category-toggle");
      if (toggle) {
         const category = toggle.closest(".category");
         category.classList.toggle("is-open");
         return;
      }

      const qtyButton = event.target.closest("[data-action][data-id]");
      if (!qtyButton) return;

      const id = Number(qtyButton.dataset.id);
      const action = qtyButton.dataset.action;

      if (action === "plus") {
         setQuantity(id, getQuantity(id) + 1);
      }

      if (action === "minus") {
         setQuantity(id, Math.max(getQuantity(id) - 1, 0));
      }

      updateQuantityView(id);
   }

   function getQuantity(id) {
      return Number(state.ordine[id] || 0);
   }

   function setQuantity(id, quantity) {
      if (quantity > 0) {
         state.ordine[id] = quantity;
      } else {
         delete state.ordine[id];
      }
   }

   function updateQuantityView(id) {
      const el = document.getElementById(`qty-${id}`);
      if (el) el.textContent = String(getQuantity(id));
   }

   function updateAllQuantities() {
      state.menu.forEach(item => updateQuantityView(item.id));
   }

   function goToRiepilogo() {
      const cliente = readClienteForm();

      if (!cliente.nomecliente || !cliente.tavolo || !cliente.coperti) {
         showToast("Compila nome, tavolo e coperti");
         return;
      }

      if (Object.keys(state.ordine).length === 0) {
         showToast("Seleziona almeno una pietanza");
         return;
      }

      state.cliente = cliente;
      renderRiepilogo();
      showPage("page-riepilogo");
   }

   function readClienteForm() {
      return {
         nomecliente: $("#nomecliente").value.trim(),
         tavolo: $("#tavolo").value.trim(),
         coperti: Number($("#coperti").value) || 0
      };
   }

   function renderRiepilogo() {
      const container = $("#riepilogo-container");
      const righe = getRigheOrdine();
      const totalePiatti = righe.reduce((sum, riga) => sum + riga.prezzo * riga.qta, 0);
      const costoCoperto = state.cliente.coperti * CONFIG.copertoUnitario;
      const totale = totalePiatti + costoCoperto;

      const righeHtml = righe.map(riga => `
         <div class="summary-row">
            <div class="name">${escapeHtml(riga.nome)}</div>
            <div class="qty">x${riga.qta}</div>
            <div class="price">${formatEuro(riga.prezzo * riga.qta)}</div>
         </div>
      `).join("");

      container.innerHTML = `
         <div class="summary-header">
            <div><strong>Nome cliente:</strong> ${escapeHtml(state.cliente.nomecliente)}</div>
            <div><strong>Tavolo:</strong> ${escapeHtml(state.cliente.tavolo)}</div>
            <div><strong>Coperti:</strong> ${state.cliente.coperti}</div>
         </div>

         ${righeHtml}

         <div class="summary-row">
            <div class="name">Coperto</div>
            <div class="qty">x${state.cliente.coperti}</div>
            <div class="price">${formatEuro(costoCoperto)}</div>
         </div>

         <div class="summary-total">
            <div>Totale</div>
            <div></div>
            <div class="price">${formatEuro(totale)}</div>
         </div>
      `;
   }

   function getRigheOrdine() {
      return Object.entries(state.ordine)
         .map(([id, qta]) => {
            const piatto = state.menu.find(item => item.id === Number(id));
            if (!piatto) return null;
            return {
               id: piatto.id,
               nome: piatto.nome,
               prezzo: piatto.prezzo,
               qta: Number(qta)
            };
         })
         .filter(Boolean);
   }

   function goToQr() {
      const payload = {
         numeroTavolo: state.cliente.tavolo,
         cliente: state.cliente.nomecliente,
         coperti: state.cliente.coperti,
         righe: getRigheOrdine().map(riga => ({
            id: riga.id,
            qta: riga.qta
         }))
      };

      renderQrCode(payload);

      // Dopo aver creato il QR, l'ordine viene azzerato per evitare ordini precedenti.
      clearOrderState();
      updateAllQuantities();

      showPage("page-qr");
   }

   function renderQrCode(payload) {
      const qrcodeElement = $("#qrcode");
      qrcodeElement.innerHTML = "";

      const qrcode = new QRCode(qrcodeElement, {
         width: 280,
         height: 280,
         useSVG: true,
         correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.H : undefined
      });

      qrcode.clear();
      qrcode.makeCode(encodeURIComponent(JSON.stringify(payload)));
   }

   function resetOrdineConferma() {
      if (Object.keys(state.ordine).length === 0) {
         showToast("L’ordine è già vuoto");
         return;
      }

      if (!confirm("Vuoi eliminare l’ordine corrente?")) return;

      clearOrderState();
      updateAllQuantities();
      showToast("Ordine eliminato");
   }

   function nuovoOrdine() {
      clearOrderState();
      clearClienteForm();
      updateAllQuantities();
      showPage("page-menu");
   }

   function clearOrderState() {
      state.ordine = {};
   }

   function clearClienteForm() {
      $("#nomecliente").value = "";
      $("#tavolo").value = "";
      $("#coperti").value = "";
   }

   function showToast(message) {
      const toast = $("#toast");
      toast.textContent = message;
      toast.classList.add("is-visible");

      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => {
         toast.classList.remove("is-visible");
      }, 2500);
   }

   function formatEuro(value) {
      return new Intl.NumberFormat("it-IT", {
         style: "currency",
         currency: "EUR"
      }).format(value);
   }

   function escapeHtml(value) {
      return String(value)
         .replaceAll("&", "&amp;")
         .replaceAll("<", "&lt;")
         .replaceAll(">", "&gt;")
         .replaceAll('"', "&quot;")
         .replaceAll("'", "&#039;");
   }
})();
