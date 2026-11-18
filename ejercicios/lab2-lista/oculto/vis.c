// Volcado de la memoria de la lista para la pestaña Visualización (oculto).
// Imprime una línea «@@VIS <línea> {json}» con la List y los nodos que se alcanzan
// desde head, tail y current (siguiendo next y prev). Revisa cada puntero antes de
// usarlo, para no caerse con punteros basura.
#include <stdint.h>
#include <unistd.h>
#include "list.h"

static int __valido(void * p, unsigned long tam) {
    uintptr_t a = (uintptr_t)p;
    return p != NULL && a % sizeof(void *) == 0 && a > 4096 && a + tam <= (uintptr_t)sbrk(0);
}

#define __MAXN 40
static Node * __nodos[__MAXN];
static int __n;

static int __indice(Node * p) {   // índice del nodo (lo agrega si es nuevo); -1 NULL, -2 basura
    if (p == NULL) return -1;
    if (!__valido(p, sizeof(Node))) return -2;
    for (int i = 0; i < __n; i++) if (__nodos[i] == p) return i;
    if (__n == __MAXN) return -2;
    __nodos[__n] = p;
    return __n++;
}

static void __ptr(const char * nombre, int i) {
    if (i == -1) printf("\"%s\":null", nombre);
    else if (i == -2) printf("\"%s\":\"?\"", nombre);
    else printf("\"%s\":%d", nombre, i);
}

void __volcar(int linea, List * L) {
    fflush(stdout);
    printf("@@VIS %d {", linea);
    if (L == NULL) { printf("\"lista\":null}\n"); return; }
    if (!__valido(L, sizeof(List))) { printf("\"lista\":\"?\"}\n"); return; }
    __n = 0;
    int h = __indice(L->head), t = __indice(L->tail), c = __indice(L->current);
    printf("\"lista\":{\"dir\":%lu,", (unsigned long)(uintptr_t)L);
    __ptr("head", h); printf(","); __ptr("tail", t); printf(","); __ptr("current", c);
    printf("},\"nodos\":[");
    for (int i = 0; i < __n; i++) {   // __n crece mientras se recorren los enlaces
        Node * x = __nodos[i];
        int nx = __indice(x->next), pv = __indice(x->prev);
        printf(i ? ",{" : "{");
        printf("\"dir\":%lu,", (unsigned long)(uintptr_t)x);
        if (x->data == NULL) printf("\"dato\":null,");
        else if (__valido(x->data, sizeof(int))) printf("\"dato\":%d,", *(int *)x->data);
        else printf("\"dato\":\"?\",");
        __ptr("next", nx); printf(","); __ptr("prev", pv);
        printf("}");
    }
    printf("]}\n");
}
