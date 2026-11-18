// Volcado de la memoria de la lista para la pestaña Visualización (oculto).
// Imprime una línea «@@VIS <línea> {json}» con la List y los nodos que se alcanzan
// desde head, tail y current (siguiendo next y prev). Revisa cada puntero antes de
// usarlo, para no caerse con punteros basura.
#include <stdint.h>
#include <unistd.h>
#include "list.h"

// malloc/calloc/free del programa pasan por aquí (la app los redefine antes de list.c),
// para saber qué direcciones están liberadas y dibujarlas así.
#undef malloc
#undef calloc
#undef free
#define __MAXL 64
static void * __lib[__MAXL];
static int __nl;
static void __olvidar(void * p) { for (int i = 0; i < __nl; i++) if (__lib[i] == p) { __lib[i] = __lib[--__nl]; return; } }
void __liberar(void * p) { if (p != NULL && __nl < __MAXL) { __olvidar(p); __lib[__nl++] = p; } free(p); }
void * __reservar(unsigned long n) { void * p = malloc(n); __olvidar(p); return p; }
void * __reservarc(unsigned long a, unsigned long b) { void * p = calloc(a, b); __olvidar(p); return p; }
static int __libre(void * p) { for (int i = 0; i < __nl; i++) if (__lib[i] == p) return 1; return 0; }

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

// Nodos vistos en volcados anteriores: un nodo liberado se sigue dibujando (con su contenido,
// que puede ser basura) solo si antes fue un nodo de verdad.
static void * __vistos[128];
static int __nvis;
static int __visto(void * p) { for (int i = 0; i < __nvis; i++) if (__vistos[i] == p) return 1; return 0; }
static void __marcar(void * p) { if (!__visto(p) && __nvis < 128) __vistos[__nvis++] = p; }
// Desde un nodo liberado solo se siguen enlaces a nodos conocidos (su memoria puede tener basura).
static int __indiceConocido(Node * p) {
    if (p == NULL) return -1;
    for (int i = 0; i < __n; i++) if (__nodos[i] == p) return i;
    return __visto(p) ? __indice(p) : -2;
}

static void __ptr(const char * nombre, int i) {
    if (i == -1) printf("\"%s\":null", nombre);
    else if (i == -2) printf("\"%s\":\"?\"", nombre);
    else printf("\"%s\":%d", nombre, i);
}

// Vuelca la lista y, opcionalmente, variables puntero a nodos (nombre → puntero).
static void __volcarCon(const char * marca, int linea, List * L, int nv, const char ** nombres, void ** ptrs) {
    fflush(stdout);
    printf("@@%s %d {", marca, linea);
    __n = 0;
    int h = -1, t = -1, c = -1, ok = 0;
    if (L == NULL) printf("\"lista\":null");
    else if (!__valido(L, sizeof(List))) printf("\"lista\":\"?\"");
    else {
        ok = 1;
        h = __indice(L->head); t = __indice(L->tail); c = __indice(L->current);
        printf("\"lista\":{\"dir\":%lu,", (unsigned long)(uintptr_t)L);
        __ptr("head", h); printf(","); __ptr("tail", t); printf(","); __ptr("current", c);
        printf("}");
    }
    int iv[16];
    for (int k = 0; k < nv && k < 16; k++) iv[k] = __indice((Node *)ptrs[k]);   // también se dibujan sus nodos
    printf(",\"vars\":[");
    for (int k = 0; k < nv && k < 16; k++) {
        printf(k ? ",{" : "{");
        printf("\"nombre\":\"%s\",", nombres[k]);
        __ptr("ptr", iv[k]);
        printf("}");
    }
    for (int k = 0; k < __nl; k++) if (__visto(__lib[k])) __indice((Node *)__lib[k]);   // los liberados que fueron nodos
    printf("],\"nodos\":[");
    for (int i = 0; i < __n; i++) {   // __n crece mientras se recorren los enlaces
        Node * x = __nodos[i];
        int libre = __libre(x);
        if (!libre) __marcar(x);
        int nx = libre ? __indiceConocido(x->next) : __indice(x->next);
        int pv = libre ? __indiceConocido(x->prev) : __indice(x->prev);
        printf(i ? ",{" : "{");
        printf("\"dir\":%lu,", (unsigned long)(uintptr_t)x);
        if (libre) printf("\"libre\":1,");
        if (x->data == NULL) printf("\"dato\":null,");
        else if (__valido(x->data, sizeof(int))) printf("\"dato\":%d,", *(int *)x->data);
        else printf("\"dato\":\"?\",");
        __ptr("next", nx); printf(","); __ptr("prev", pv);
        printf("}");
    }
    printf("],\"liberados\":[");
    for (int k = 0; k < __nl; k++) printf(k ? ",%lu" : "%lu", (unsigned long)(uintptr_t)__lib[k]);
    printf("]}\n");
    (void)ok;
}

// Después de cada línea del test.
void __volcar(int linea, List * L) { __volcarCon("VIS", linea, L, 0, 0, 0); }

// Dentro de la función del estudiante (línea de list.c), con sus variables Node *.
void __volcarf(int linea, List * L, int nv, const char ** nombres, void ** ptrs) {
    __volcarCon("VISF", linea, L, nv, nombres, ptrs);
}
