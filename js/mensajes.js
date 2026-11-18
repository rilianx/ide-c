// Traducción al castellano de los mensajes del compilador (xcc), con una pista para el estudiante.
// La lista sale de los textos que trae el compilador (cc.wasm); se traduce aquí, sin conexión.
// Cada entrada: [expresión regular sobre el mensaje en inglés, función que arma el texto].

import TODOS from './mensajes-xcc.js?v=202611182056';

const q = s => `«${s}»`;
const REGLAS = [
  // nombres
  [/^`(.+?)' undeclared$/, m => `${q(m[1])} no está declarada. ¿Falta declararla (por ejemplo, Node * ${m[1]} = …;) o está mal escrita?`],
  [/^`(.+?)' undefined$/, m => `${q(m[1])} no está definida. ¿Está bien escrito el nombre?`],
  [/^`(.+?)' not found$/, m => `No se encontró ${q(m[1])}. ¿Está bien escrito el nombre?`],
  [/`(.+?)' is not member of struct|`(.+?)' doesn't exist in the struct/, m => `${q(m[1] ?? m[2])} no es un campo de ese struct. Revisa los campos en list.h (por ejemplo: head, tail, current, data, next, prev).`],
  [/`\.' for non struct value/, () => 'Se usó «.» con un puntero: para llegar a un campo a través de un puntero se usa «->» (por ejemplo, list->head).'],
  [/^`(.+?)' function already defined$/, m => `La función ${q(m[1])} está definida dos veces. Deja solo una.`],
  [/^`(.+?)' (?:is )?already defined$/, m => `${q(m[1])} ya está declarada antes. Usa otro nombre, o quita el tipo si solo quieres cambiar su valor (${m[1]} = …;).`],
  [/definition conflict: `(.+?)'/, m => `${q(m[1])} se declaró de dos formas distintas.`],
  [/^`(.+?)' type conflict$/, m => `${q(m[1])} tiene un tipo distinto al que se declaró antes (revisa el prototipo en list.h).`],
  [/unused variable:? `(.+?)'/, m => `La variable ${q(m[1])} se declara pero no se usa.`],
  [/^`(.+?)' not used$/, m => `${q(m[1])} no se usa.`],
  // puntuación
  [/`;' or `,' expected/, () => 'Falta un «;» (o una «,»). Revisa el final de esta línea o de la anterior.'],
  [/`;' expected/, () => 'Falta un «;». Revisa el final de esta línea o de la anterior.'],
  [/`\)' expected|Expect '\)' after expression/, () => 'Falta cerrar un paréntesis «)».'],
  [/`\(' expected/, () => 'Falta abrir un paréntesis «(». Por ejemplo: if (condición), while (condición).'],
  [/`}' or `,' expected/, () => 'Falta una «}» (o una «,»).'],
  [/`}' expected/, () => 'Falta cerrar una llave «}». Revisa que cada «{» tenga su «}».'],
  [/`]' expected/, () => 'Falta cerrar un corchete «]».'],
  [/`,' or `\)'? expected/, () => 'Falta una «,» o un «)» en la lista de argumentos.'],
  [/`,' expected/, () => 'Falta una «,».'],
  [/`:' expected/, () => 'Falta «:» (en un case o en el operador ? :).'],
  [/`while' expected/, () => 'Falta el «while (…)» al final del do { … }.'],
  [/`"' expected|String not closed|Quote not closed/, () => 'Hay un texto entre comillas que no se cerró: falta una «"».'],
  [/Character not closed/, () => 'Falta cerrar un carácter con «\'».'],
  [/Block comment not closed|block comment not closed/, () => 'Un comentario /* … no se cerró: falta «*/».'],
  [/if not closed/, () => 'Un #if no se cerró con #endif.'],
  // expresiones y tipos
  [/Expect expression|expression expected|illegal expression/, () => 'Se esperaba una expresión (un valor, una variable, una llamada…) y hay otra cosa. Revisa esta parte de la línea.'],
  [/unexpected token/, () => 'Hay algo que sobra o está fuera de lugar en esta línea.'],
  [/Unexpected character `(.)'/, m => `El carácter ${q(m[1])} no se puede usar aquí.`],
  [/illegal character: (.)/, m => `El carácter ${q(m[1])} no se puede usar aquí.`],
  [/statement expected/, () => 'Se esperaba una instrucción.'],
  [/type expected|int type expected|number type expected/, () => 'Se esperaba un tipo (por ejemplo, int, void *, Node *).'],
  [/ident expected|member name expected|variable expected/, () => 'Se esperaba un nombre (de variable o de campo).'],
  [/cannot assign to incompatible struct|incompatible type/, () => 'Los tipos no coinciden: se está usando un valor de un tipo donde se espera otro (por ejemplo, un Node * donde va un List *, o un dato donde va un nodo).'],
  [/lvalue expected|Cannot assign|cannot assign to (.+)/, () => 'Lo que está a la izquierda del «=» no se puede asignar: tiene que ser una variable o un campo (por ejemplo, list->head = …).'],
  [/compare pointer to other types/, () => 'Se compara un puntero con algo de otro tipo. ¿Se compara un Node * con un dato (void *) o con un número?'],
  [/cannot compare except numbers/, () => 'Solo se pueden comparar números o punteros.'],
  [/different pointer diff/, () => 'Se restan punteros de tipos distintos.'],
  [/cannot dereference raw type/, () => 'Se usa «*» o «->» con algo que no es un puntero.'],
  [/array or pointer required for `\['/, () => 'Se usa «[ ]» con algo que no es un arreglo ni un puntero.'],
  [/cannot call except function/, () => 'Se usa «( )» con algo que no es una función.'],
  [/function `(.+?)' expect (\d+) arguments, but (\d+)/, m => `${q(m[1])} recibe ${m[2]} argumento${m[2] === '1' ? '' : 's'}, pero se le pasan ${m[3]}.`],
  [/Too (many|few) arguments for macro `(.+?)'/, m => `La macro ${q(m[2])} recibe ${m[1] === 'many' ? 'menos' : 'más'} argumentos.`],
  [/cannot apply `!' except number or pointer types/, () => 'El operador «!» solo se usa con números o punteros.'],
  [/cannot apply `(.)' except number types|cannot apply `(.+?)'/, m => `El operador ${q(m[1] ?? m[2])} no se puede usar con ese tipo de valor.`],
  [/cannot modify `const'/, () => 'Se intenta cambiar algo declarado const.'],
  [/incomplete struct: `(.+?)'/, m => `El struct ${q(m[1])} no está definido aquí (¿falta incluir list.h?).`],
  [/size unknown/, () => 'No se conoce el tamaño de ese tipo (¿falta incluir list.h?).'],
  [/pointer subtraction of void\*/, () => 'No se pueden restar punteros void *.'],
  // return y funciones
  [/void function `return' a value|`return' with void value/, () => 'Esta función es void: el return no lleva valor (solo «return;»).'],
  [/`return' required a value/, () => 'Esta función debe retornar un valor: «return algo;».'],
  [/`return' required/, () => 'A la función le falta un return al final.'],
  [/`(.+?)' cannot be used outside of loop/, m => `${q(m[1])} solo se puede usar dentro de un ciclo (for, while).`],
  [/cannot use outside of `switch`/, () => 'case/default solo se usan dentro de un switch.'],
  [/function's parameters must be known/, () => 'Hay que indicar el tipo de cada parámetro.'],
  [/`void' not allowed/, () => 'void no se puede usar aquí (¿querías void *?).'],
  [/convert value from type `(.+?)' to `(.+?)'/, m => `se convierte un valor de tipo ${q(m[1])} a ${q(m[2])}. ¿Falta declarar una variable, o se mezclan tipos (por ejemplo, un dato void * con un Node *)?`],
  // printf / scanf
  [/format `(.+?)' expects argument of type `(.+?)', but argument (\d+) has type `(.+?)'/, m => `En printf/scanf, ${q(m[1])} espera un ${q(m[2])}, pero el argumento ${m[3]} es ${q(m[4])}.`],
  [/format `(.+?)' expects a matching argument/, m => `En printf/scanf falta el argumento para ${q(m[1])}.`],
  [/too many arguments for format/, () => 'printf/scanf recibe más argumentos que los % del formato.'],
  [/unknown conversion `(.+?)' in format|incomplete format specifier `(.+?)'/, m => `${q(m[1] ?? m[2])} no es un formato válido para printf/scanf.`],
  // archivos
  [/Cannot open file: (.+)|cannot open: (.+)|illegal include: (.+)/, m => `No se encontró el archivo ${q((m[1] ?? m[2] ?? m[3]).trim())} (revisa el #include).`],
  [/initializer must be constant|constant expression expected|constant integer expected/, () => 'Aquí se necesita un valor constante.'],
  [/excess elements in array initializer|initializer more than array size/, () => 'El arreglo tiene más valores que su tamaño.'],
  [/array size must be greater than 0/, () => 'El tamaño de un arreglo debe ser mayor que 0.'],
];

// Todos los demás mensajes del compilador y su librería (traducidos con un modelo y generados
// por herramientas/generar-mensajes.mjs): [expresión, traducción con %s…, pista].
const XCC = TODOS.map(([re, es, pista]) => [new RegExp(re), es, pista]);
const PH = /%(?:\.\*s|[-0-9]*l{0,2}[sdcuxzi]|zd|zu|zx)/g;

// {texto, original}: el mensaje en castellano (o null si no se conoce) y el original.
export function traducirMensaje(original) {
  const sinPrefijo = original.replace(/^\s*(error|warning|Warning):\s*/i, '');
  const aviso = /^\s*warning/i.test(original) ? 'Aviso: ' : '';
  for (const [re, f] of REGLAS) {   // primero las escritas a mano (con pistas más detalladas)
    const m = re.exec(sinPrefijo);
    if (m) return { texto: aviso + f(m), original };
  }
  for (const [re, es, pista] of XCC) {
    const m = re.exec(sinPrefijo);
    if (!m) continue;
    let k = 1;
    const texto = es.replace(PH, () => m[k++] ?? '');
    const punto = /[.?!:)»]$/.test(texto) ? '' : '.';
    return { texto: aviso + texto + (pista ? punto + ' ' + pista : ''), original };
  }
  return { texto: null, original };
}
