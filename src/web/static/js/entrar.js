const tela = document.querySelector(".entrar");

tela.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-ir]");
    if(!botao) return;
    tela.dataset.tela = botao.dataset.ir;
    sincronizarInerte();
});

function sincronizarInerte() {
    document.querySelectorAll("[data-painel], [data-hero]").forEach(e => {
        const meu = e.dataset.painel || e.dataset.hero;
        e.inert = meu !== tela.dataset.tela;
    });
}