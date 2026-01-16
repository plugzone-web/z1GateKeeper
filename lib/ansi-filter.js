/**
 * Filtra sequências ANSI que não devem aparecer no terminal
 * Remove OSC (Operating System Command), sequências de controle, etc.
 */
function filterAnsiControlSequences(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }
    
    let result = text;
    
    // Remove OSC (Operating System Command) sequences completas
    // Formato: \x1b]NUMBER;TEXT\x07 ou \x1b]NUMBER;TEXT\x1b\\
    // Exemplo: \x1b]0;root@us15:~\x07
    result = result.replace(/\x1b\]\d+;[^\x07\x1b]*[\x07\x1b\\]/g, '');
    result = result.replace(/\033\]\d+;[^\x07\x1b]*[\x07\x1b\\]/g, '');
    
    // Remove sequências OSC incompletas ou mal formatadas
    // Captura desde ] até encontrar um caractere de controle ou fim de sequência
    // Isso pega casos como ]0;root@us15:~ que aparecem sem o ESC inicial visível
    result = result.replace(/\x1b\]\d+;[^\x07\x1b\n\r]*/g, '');
    result = result.replace(/\033\]\d+;[^\x07\x1b\n\r]*/g, '');
    
    // Remove sequências que começam com ] seguido de número e ponto-e-vírgula
    // Isso pega casos onde o ESC foi perdido mas a sequência ainda está lá
    result = result.replace(/\]\d+;[^\x07\x1b\n\r]*[\x07\x1b\\]?/g, '');
    
    // Remove BEL (bell) - \x07 (usado para terminar OSC)
    result = result.replace(/\x07/g, '');
    
    // Remove sequências de escape malformadas que podem aparecer
    // Remove ESC seguido de caracteres não válidos (exceto [ para códigos de cor)
    result = result.replace(/\x1b(?!\[)[^\x1b]/g, '');
    result = result.replace(/\033(?!\[)[^\033]/g, '');
    
    return result;
}

module.exports = { filterAnsiControlSequences };
