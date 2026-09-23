const LIMITE = 6

// chave por usuário: em computador compartilhado do escritório, os recentes
// de quem usou antes não podem aparecer pra quem usa depois
const chave = (usuarioId: number) => `up-hub-recentes:${usuarioId}`

export function lerRecentes(usuarioId: number): string[] {
    try {
        const bruto = localStorage.getItem(chave(usuarioId))
        const lista = bruto ? JSON.parse(bruto) : []
        return Array.isArray(lista) ? lista.filter((s) => typeof s === 'string') : []
    } catch {
        return []        // aba anônima, storage desligado, JSON estragado: segue sem recentes        
    }
}

export function registrarRecente(usuarioId: number, slug: string): string[] {
    const lista = [slug, ...lerRecentes(usuarioId).filter((s) => s !== slug)].slice(0, LIMITE)
    try {
        localStorage.setItem(chave(usuarioId), JSON.stringify(lista))
    } catch {
        // sem espaço ou bloqueado: a lista ainda vale enquanto a aba estiver aberta
    }
    return lista
}