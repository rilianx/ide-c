// Volcado de la memoria del árbol para la visualización (oculto).
// Imprime «@@VIS <línea> {json}» con el TreeMap y sus nodos: los que se alcanzan desde root
// (por left/right), current, las variables y los vistos antes (aunque ya no estén en el árbol).
// Revisa cada puntero antes de usarlo, para no caerse con punteros basura.
#include <stdint.h>
#include <stdarg.h>
#include <unistd.h>
#include "treemap.h"

#undef malloc
#undef calloc
#undef free
#define __MAXL 128
static void * __lib[__MAXL];
static int __nl;
static void __olvidar(void * p) { for (int i = 0; i < __nl; i++) if (__lib[i] == p) { __lib[i] = __lib[--__nl]; return; } }
void __liberar(void * p) { if (p != NULL && __nl < __MAXL) { __olvidar(p); __lib[__nl++] = p; } free(p); }
void * __reservar(unsigned long n) { void * p = malloc(n); __olvidar(p); return p; }
void * __reservarc(unsigned long a, unsigned long b) { void * p = calloc(a, b); __olvidar(p); return p; }
static int __libre(void * p) { for (int i = 0; i < __nl; i++) if (__lib[i] == p) return 1; return 0; }

static int __valido(void * p, unsigned long tam) {
    uintptr_t a = (uintptr_t)p;
    return p != NULL && a > 4096 && a + tam <= (uintptr_t)sbrk(0);
}

#define __MAXN 60
static TreeNode * __nodos[__MAXN];
static int __n;
static TreeNode * __vistos[__MAXN];
static int __nv;
static int __indice(TreeNode * p) {   // -1 NULL, -2 basura
    if (p == NULL) return -1;
    if (((uintptr_t)p) % sizeof(void *) || !__valido(p, sizeof(TreeNode))) return -2;
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
static void __clave(const char * nombre, void * k) {   // el int al que apunta
    printf("\"%s\":", nombre);
    if (k == NULL) printf("null");
    else if (((uintptr_t)k) % sizeof(int) || !__valido(k, sizeof(int))) printf("\"?\"");
    else printf("%d", *(int *)k);
}
static void __texto(const char * nombre, char * s) {
    printf("\"%s\":", nombre);
    if (s == NULL) { printf("null"); return; }
    if (!__valido(s, 1)) { printf("\"?\""); return; }
    printf("{\"t\":\"");
    for (int i = 0; i < 16 && s[i] && __valido(s + i, 1); i++) {
        unsigned char c = (unsigned char)s[i];
        if (c == '"' || c == '\\') printf("\\%c", c); else if (c < 32 || c > 126) printf("?"); else printf("%c", c);
    }
    printf("\"}");
}
static int __lt(int (*f)(void *, void *));

// Variables: 0 TreeNode *, 1 dato (void *: el int al que apunta), 2 entero, 3 double, 4 texto, 5 Pair *.
static void __volcarCon(const char * marca, int linea, TreeMap * M, int nv, const char ** nombres, void ** ptrs,
                        const int * tipos, const long * ents, const double * dbls) {
    fflush(stdout);
    printf("@@%s %d {", marca, linea);
    __n = 0;
    if (M == NULL) printf("\"arbol\":null");
    else if (((uintptr_t)M) % sizeof(void *) || !__valido(M, sizeof(TreeMap))) printf("\"arbol\":\"?\"");
    else {
        int r = __indice(M->root), c = __indice(M->current);
        printf("\"arbol\":{\"dir\":%lu,", (unsigned long)(uintptr_t)M);
        __ptr("root", r); printf(","); __ptr("current", c);
        printf(",\"lt\":%d}", __lt(M->lower_than));
    }
    int iv[16];
    for (int k = 0; k < nv && k < 16; k++) iv[k] = tipos[k] == 0 ? __indice((TreeNode *)ptrs[k]) : 0;
    for (int k = 0; k < __nv; k++) if (!__libre(__vistos[k])) __indice(__vistos[k]);
    printf(",\"vars\":[");
    for (int k = 0; k < nv && k < 16; k++) {
        printf(k ? ",{" : "{");
        printf("\"nombre\":\"%s\",", nombres[k]);
        int t = tipos[k];
        if (t == 0) __ptr("ptr", iv[k]);
        else if (t == 1) { if (strcmp(nombres[k], "value") == 0) __texto("texto", (char *)ptrs[k]); else __clave("dato", ptrs[k]); }   // value: una palabra
        else if (t == 2) printf("\"valor\":%ld", ents[k]);
        else if (t == 3) printf("\"valor\":%g", dbls[k]);
        else if (t == 4) __texto("texto", (char *)ptrs[k]);
        else {   // Pair *: su dirección (se dibuja en el nodo que lo tiene)
            if (ptrs[k] == NULL) printf("\"par\":null");
            else if (!__valido(ptrs[k], sizeof(Pair))) printf("\"par\":\"?\"");
            else { printf("\"par\":%lu,", (unsigned long)(uintptr_t)ptrs[k]); __clave("clave", ((Pair *)ptrs[k])->key); }
        }
        printf("}");
    }
    printf("],\"nodos\":[");
    for (int i = 0; i < __n; i++) {   // __n crece mientras se recorren los hijos
        TreeNode * x = __nodos[i];
        int ya = 0;
        for (int k = 0; k < __nv; k++) if (__vistos[k] == x) ya = 1;
        if (!ya && __nv < __MAXN) __vistos[__nv++] = x;
        int l = __indice(x->left), r = __indice(x->right), p = __indice(x->parent);
        printf(i ? ",{" : "{");
        printf("\"dir\":%lu,", (unsigned long)(uintptr_t)x);
        if (x->pair == NULL) printf("\"par\":null,\"clave\":null,\"valor\":null,");
        else if (!__valido(x->pair, sizeof(Pair))) printf("\"par\":\"?\",\"clave\":\"?\",\"valor\":null,");
        else { printf("\"par\":%lu,", (unsigned long)(uintptr_t)x->pair); __clave("clave", x->pair->key); printf(","); __texto("valor", (char *)x->pair->value); printf(","); }
        __ptr("left", l); printf(","); __ptr("right", r); printf(","); __ptr("parent", p);
        printf("}");
    }
    printf("]}\n");
}
static int __lt(int (*f)(void *, void *)) { return f == NULL ? 0 : f == lower_than_int ? 1 : 2; }

int __voy(int n) { fflush(stdout); printf("@@L %d\n", n); fflush(stdout); return 0; }
int __voyf(int n) { fflush(stdout); printf("@@LF %d\n", n); fflush(stdout); return 0; }

void * __ck(void * p, int linea) {
    const char * tipo = p == NULL ? "NULL" : !__valido(p, 1) ? "BASURA" : __libre(p) ? "LIBERADO" : 0;
    if (tipo) {
        fflush(stdout);
        printf("@@FALLA %d %s\n", linea, tipo);
        fflush(stdout);
        exit(1);
    }
    return p;
}

int __volcar(int linea, TreeMap * M) { __volcarCon("VIS", linea, M, 0, 0, 0, 0, 0, 0); return 0; }

int __volcarv(int linea, TreeMap * M, int nv, ...) {
    const char * nombres[16]; void * ptrs[16]; int tipos[16]; long ents[16]; double dbls[16];
    va_list a;
    va_start(a, nv);
    for (int k = 0; k < nv && k < 16; k++) {
        tipos[k] = va_arg(a, int);
        nombres[k] = va_arg(a, const char *);
        ptrs[k] = 0; ents[k] = 0; dbls[k] = 0;
        if (tipos[k] == 2) ents[k] = va_arg(a, long);
        else if (tipos[k] == 3) dbls[k] = va_arg(a, double);
        else ptrs[k] = va_arg(a, void *);
    }
    va_end(a);
    __volcarCon("VISF", linea, M, nv < 16 ? nv : 16, nombres, ptrs, tipos, ents, dbls);
    return 0;
}
