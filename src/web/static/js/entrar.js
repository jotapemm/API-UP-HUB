const tela = document.querySelector(".entrar");

tela.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-ir]");
    if (!botao) return;
    tela.dataset.tela = botao.dataset.ir;
    sincronizarInerte();
});

function sincronizarInerte() {
    document.querySelectorAll("[data-painel], [data-hero]").forEach(e => {
        const meu = e.dataset.painel || e.dataset.hero;
        e.inert = meu !== tela.dataset.tela;
    });
}

const formLogin = document.querySelector('[data-painel="login"]');
const erroLogin = document.querySelector("#login-erro");

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroLogin.hidden = true;

    const email = document.querySelector("#login-email").value;
    const senha = document.querySelector("#login-senha").value;

    const resposta = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
    });

    if (resposta.ok) {
        location.href = "/app.html";
        return;
    }

    const corpo = await resposta.json().catch(() => ({}));
    erroLogin.textContent = corpo.detail || "Não foi possível entrar.";
    erroLogin.hidden = false;
    document.querySelector("#login-senha").value = "";
});
