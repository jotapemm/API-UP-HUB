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

const formCadastro = document.querySelector('[data-painel="cadastro"]');
const erroCadastro = document.querySelector('#cadastro-erro');

formCadastro.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroCadastro.hidden = true;

    const nome = document.querySelector("#cadastro-nome").value;
    const apelido = document.querySelector("#cadastro-apelido").value;
    const email = document.querySelector("#cadastro-email").value;
    const senha = document.querySelector("#cadastro-senha").value;
    const confirmar = document.querySelector("#cadastro-confirmar").value;
    
    if(senha !== confirmar) {
        erroCadastro.textContent = corpo.detail || "As senhas inseridas não coincidem";
        erroCadastro.hidden = false;
        return;
    } 

    const resposta = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({nome, apelido, email, senha}),
    });

    if(resposta.ok){
        location.ref = "/entrar.html"; 
        /* entrar.html definido por padrão, 
        o primeiro acesso no login, quando cadastrado, 
        o usuário será redirecionado pro login. */
        return;
    }

    const corpo = await resposta.json().catch(() => ({}));
    erroCadastro.textContent = corpo.detail || "Não foi possível cadastrar.";
    erroCadastro.hidden = false

});

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