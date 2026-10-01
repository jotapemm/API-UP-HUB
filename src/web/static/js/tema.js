/* ═══════════════════════════════════════════════════════════════════
   TEMA — uma escolha, três estados, duas casas (login e hub)

   Este arquivo NÃO é módulo e NÃO leva defer, de propósito. Ele tem
   que rodar antes da primeira pintura. Se rodar depois, o usuário vê
   um quadro do tema errado e só então a tela se corrige — o pisca tem
   nome (FOUC) e a única cura é bloquear o parser por um instante aqui.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    const CHAVE = 'up:tema';
    /* "sistema" é o padrão e não é uma cor: é a AUSÊNCIA de escolha.
   Por isso ele não fica salvo — nada no localStorage já é ele.     */
    function ler() {
        try {
            const v = localStorage.getItem(CHAVE);
            return v === 'claro' || v === 'escuro' ? v : 'sistema';
        } catch {
            return 'sistema';       // janela privada, storage bloqueado
        }
    }

    /* Aplicar é trocar UMA linha. O color-scheme inline vence o do
    :root; apagar o inline devolve o comando pro :root.             */
    function aplicar(tema) {
        document.documentElement.style.colorScheme =
            tema === 'claro' ? 'light' : tema === 'escuro' ? 'dark' : '';
    }

    function salvar(tema) {
        try {
            if (tema === 'sistema') localStorage.removeItem(CHAVE);
            else localStorage.setItem(CHAVE, tema);
        } catch { }

        aplicar(tema);

        /* quem desenha FORA do CSS precisa ser avisado na mão */
        dispatchEvent(new CustomEvent('up:tema', { detail: tema }));
    }

    /* Devolve um token já RESOLVIDO em cor.

   getComputedStyle(raiz).getPropertyValue('--trama-alto') NÃO serve:
   custom property guarda o texto que você escreveu, e o texto aqui é
   "light-dark(#0A6B51, #00C48C)" — não é cor nenhuma. Eu medi isso.

   A sonda abaixo faz uma propriedade DE VERDADE consumir o token, e
   só então o navegador resolve. Aí sai "rgb(0, 196, 140)".          */

   function cor(token) {
    const s = document.createElement('span');
    s.style.color = `var(${token})`;
    document.documentElement.appendChild(s);
    const v = getComputedStyle(s).color;
    s.remove();
    return v;
   }

   aplicar(ler());              // antes de qualquer pintura

   window.UPTema = { ler, salvar, aplicar, cor };
})();