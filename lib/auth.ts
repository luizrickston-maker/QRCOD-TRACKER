// ============================================================
// Controle de acesso ao painel admin.
//
// Autenticar (estar logado no Supabase) NÃO basta: se o signup
// estiver habilitado no projeto Supabase, qualquer um poderia
// criar conta. Aqui restringimos o acesso a uma allowlist de
// e-mails definida em ADMIN_EMAILS (separados por vírgula).
//
// Comportamento:
//   - ADMIN_EMAILS vazio/ausente => permite qualquer usuário
//     autenticado (NÃO recomendado em produção; logamos um aviso).
//   - ADMIN_EMAILS definido       => só esses e-mails têm acesso.
// ============================================================

let warned = false

export function isAuthorizedAdmin(email: string | null | undefined): boolean {
  const raw = process.env.ADMIN_EMAILS ?? ''
  const allow = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (allow.length === 0) {
    if (!warned) {
      console.warn(
        '[auth] ADMIN_EMAILS não configurado — qualquer usuário autenticado tem acesso ao admin. Defina ADMIN_EMAILS para restringir.'
      )
      warned = true
    }
    return true
  }

  return !!email && allow.includes(email.toLowerCase())
}
