const tela = document.querySelector(".entrar");

function sincronizarInerte() {
    document.querySelectorAll("[data-painel], [data-hero]").forEach(e => {
        const meu = e.dataset.painel || e.dataset.hero;
        e.inert = meu !== tela.dataset.tela;
    });
}

sincronizarInerte()

function mensagemDoErro(corpo, padrao) {
    const d = corpo.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length) {
        const campo = d[0].loc?.[1];
        if (campo === "senha") return "A senha precisa ter pelo menos 8 caracteres.";
        if (campo === "email") return "Esse email não parece válido.";
        if (campo === "nome") return "O nome precisa ter pelo menos 3 caracteres.";
    }
    return padrao;
}

tela.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-ir]");
    if (!botao) return;
    tela.dataset.tela = botao.dataset.ir;
    sincronizarInerte();
});

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

    if (senha !== confirmar) {
        erroCadastro.textContent = "As senhas inseridas não coincidem";;
        erroCadastro.hidden = false;
        return;
    }

    const resposta = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, apelido, email, senha }),
    });

    if (resposta.ok) {
        document.querySelector("#login-email").value = email;
        tela.dataset.tela = "login";
        sincronizarInerte();
        return;
    }

    const corpo = await resposta.json().catch(() => ({}));
    erroCadastro.textContent = mensagemDoErro(corpo, "Não foi possível cadastrar.");
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
        location.href = "/app/";
        return;
    }

    const corpo = await resposta.json().catch(() => ({}));
    erroLogin.textContent = mensagemDoErro(corpo, "Não foi possível entrar.");
    erroLogin.hidden = false;
    document.querySelector("#login-senha").value = "";
});