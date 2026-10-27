/** Traduz as mensagens que o Supabase devolve em inglês. */
export function translateAuthError(raw: string): string {
  const message = raw.toLowerCase();
  if (!message) return 'Não foi possível concluir. Tente novamente.';
  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (message.includes('email not confirmed')) {
    return 'Confirme o e-mail antes de entrar. O link está na sua caixa de entrada.';
  }
  if (
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('user already')
  ) {
    return 'Este e-mail já está cadastrado.';
  }
  if (message.includes('password should be') || message.includes('at least')) {
    return 'A senha precisa ter pelo menos 8 caracteres, com letras e um número ou símbolo.';
  }
  if (message.includes('weak') && message.includes('password')) {
    return 'Essa senha é fácil demais. Misture letras, números e um símbolo.';
  }
  if (message.includes('password')) return 'A senha não foi aceita. Tente outra com 8 caracteres ou mais.';
  if (
    message.includes('unable to validate email') ||
    message.includes('invalid email') ||
    (message.includes('email') && message.includes('invalid'))
  ) {
    return 'Informe um e-mail válido.';
  }
  if (
    message.includes('rate limit') ||
    message.includes('too many') ||
    message.includes('over_request') ||
    message.includes('muitas')
  ) {
    return 'Muitas tentativas. Espere um pouco e tente de novo.';
  }
  if (
    message.includes('profiles_username') ||
    message.includes('duplicate') ||
    message.includes('23505') ||
    message.includes('already in use')
  ) {
    return 'Este nome de usuário já está em uso.';
  }
  if (message.includes('provider is not enabled') || message.includes('unsupported provider')) {
    return 'Esse login ainda não está ligado no Supabase. Dá para entrar com e-mail e senha.';
  }
  if (message.includes('signup') && message.includes('disabled')) {
    return 'O cadastro está fechado neste projeto.';
  }
  if (message.includes('otp') && (message.includes('expired') || message.includes('invalid'))) {
    return 'Esse link expirou. Peça outro.';
  }
  if (message.includes('jwt') || message.includes('refresh token') || message.includes('session expired')) {
    return 'Sua sessão expirou. Entre de novo.';
  }
  if (message.includes('same password') || message.includes('different from the old')) {
    return 'Escolha uma senha diferente da atual.';
  }
  if (message.includes('user banned') || message.includes('banned')) {
    return 'Esta conta está bloqueada.';
  }
  if (
    message.includes('show_adult') ||
    message.includes('profile_visibility') ||
    message.includes('show_activity') ||
    message.includes('allow_friend_requests') ||
    message.includes('content_rating') ||
    message.includes('user_blocks') ||
    message.includes('user_reports') ||
    message.includes('username_taken')
  ) {
    return 'Falta aplicar a migration 011_account_privacy.sql no Supabase.';
  }
  if (
    message.includes('onboarded_at') ||
    message.includes('banner_url') ||
    message.includes('schema cache') ||
    message.includes('column')
  ) {
    return 'Falta aplicar uma migration nova no Supabase.';
  }
  if (message.includes('network') || message.includes('failed to fetch')) {
    return 'Sem conexão com o servidor. Tente de novo.';
  }
  if (message.includes('avatar precisa') || message.includes('banner precisa')) return raw;
  return 'Não foi possível concluir. Tente novamente.';
}
