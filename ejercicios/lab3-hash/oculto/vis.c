// Volcado de la memoria de la tabla hash para la visualización (oculto).
// Imprime una línea «@@VIS <línea> {json}» con el HashMap, sus casillas y los pares
// (también los que se vieron antes y ya no están en la tabla). Revisa cada puntero
// antes de usarlo, para no caerse con punteros basura.
#include <stdint.h>
#include <stdarg.h>
#include <unistd.h>
#include "hashmap.h"

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

// Pares: los de este volcado y los vistos antes (siguen dibujándose aunque salgan de la tabla).
#define __MAXP 80
static Pair * __pares[__MAXP];
static int __np;
static Pair * __vistos[__MAXP];
static int __nv;
static int __indice(Pair * p) {   // -1 NULL, -2 basura
    if (p == NULL) return -1;
    if (((uintptr_t)p) % sizeof(void *) || !__valido(p, sizeof(Pair))) return -2;
    for (int i = 0; i < __np; i++) if (__pares[i] == p) return i;
    if (__np == __MAXP) return -2;
    __pares[__np] = p;
    return __np++;
}

static void __texto(const char * nombre, char * s) {   // "nombre":"texto" (o null, o "?")
    printf("\"%s\":", nombre);
    if (s == NULL) { printf("null"); return; }
    if (!__valido(s, 1)) { printf("\"?\""); return; }
    printf("{\"t\":\"");
    for (int i = 0; i < 24 && s[i] && __valido(s + i, 1); i++) {
        unsigned char c = (unsigned char)s[i];
        if (c == '"' || c == '\\') printf("\\%c", c);
        else if (c < 32 || c > 126) printf("?");
        else printf("%c", c);
    }
    printf("\"}");
}

static void __ptr(const char * nombre, int i) {
    if (i == -1) printf("\"%s\":null", nombre);
    else if (i == -2) printf("\"%s\":\"?\"", nombre);
    else printf("\"%s\":%d", nombre, i);
}

// Variables: tipos[k] = 0 puntero a Pair, 1 valor (void *, el int al que apunta), 2 entero, 3 double, 4 texto (char *).
static void __volcarCon(const char * marca, int linea, HashMap * M, int nv, const char ** nombres, void ** ptrs,
                        const int * tipos, const long * ents, const double * dbls) {
    fflush(stdout);
    printf("@@%s %d {", marca, linea);
    __np = 0;
    long cap = 0;
    int casillas[64];
    if (M == NULL) printf("\"mapa\":null");
    else if (((uintptr_t)M) % sizeof(void *) || !__valido(M, sizeof(HashMap))) printf("\"mapa\":\"?\"");
    else {
        printf("\"mapa\":{\"dir\":%lu,\"size\":%ld,\"capacity\":%ld,\"current\":%ld,\"buckets\":", (unsigned long)(uintptr_t)M, M->size, M->capacity, M->current);
        if (M->buckets == NULL) printf("null");
        else if (M->capacity < 1 || M->capacity > 64 || !__valido(M->buckets, M->capacity * sizeof(Pair *))) printf("\"?\"");
        else {
            cap = M->capacity;
            for (long i = 0; i < cap; i++) casillas[i] = __indice(M->buckets[i]);
            printf("[");
            for (long i = 0; i < cap; i++) {
                if (i) printf(",");
                if (casillas[i] == -1) printf("null"); else if (casillas[i] == -2) printf("\"?\""); else printf("%d", casillas[i]);
            }
            printf("]");
        }
        printf("}");
    }
    int iv[16];
    for (int k = 0; k < nv && k < 16; k++) iv[k] = tipos[k] == 0 ? __indice((Pair *)ptrs[k]) : 0;
    for (int k = 0; k < __nv; k++) if (!__libre(__vistos[k])) __indice(__vistos[k]);   // los vistos antes
    printf(",\"vars\":[");
    for (int k = 0; k < nv && k < 16; k++) {
        printf(k ? ",{" : "{");
        printf("\"nombre\":\"%s\",", nombres[k]);
        int t = tipos[k];
        if (t == 0) __ptr("ptr", iv[k]);
        else if (t == 1) {
            if (ptrs[k] == NULL) printf("\"dato\":null");
            else if (__valido(ptrs[k], sizeof(int))) printf("\"dato\":%d", *(int *)ptrs[k]);
            else printf("\"dato\":\"?\"");
        }
        else if (t == 2) printf("\"valor\":%ld", ents[k]);
        else if (t == 3) printf("\"valor\":%g", dbls[k]);
        else __texto("texto", (char *)ptrs[k]);
        printf("}");
    }
    printf("],\"pares\":[");
    for (int i = 0; i < __np; i++) {
        Pair * p = __pares[i];
        int ya = 0;
        for (int k = 0; k < __nv; k++) if (__vistos[k] == p) ya = 1;
        if (!ya && __nv < __MAXP) __vistos[__nv++] = p;
        printf(i ? ",{" : "{");
        printf("\"dir\":%lu,", (unsigned long)(uintptr_t)p);
        __texto("key", p->key);
        printf(",");
        if (p->value == NULL) printf("\"valor\":null");
        else if (__valido(p->value, sizeof(int))) printf("\"valor\":%d", *(int *)p->value);
        else printf("\"valor\":\"?\"");
        printf("}");
    }
    printf("]}\n");
}

int __voy(int n) { fflush(stdout); printf("@@L %d\n", n); fflush(stdout); return 0; }
int __voyf(int n) { fflush(stdout); printf("@@LF %d\n", n); fflush(stdout); return 0; }

// Antes de cada «p->campo» en las funciones del estudiante: si p es NULL, basura o memoria
// liberada, se avisa y se detiene el programa (el intérprete no siempre lo detecta solo).
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

int __volcar(int linea, HashMap * M) { __volcarCon("VIS", linea, M, 0, 0, 0, 0, 0, 0); return 0; }

int __volcarv(int linea, HashMap * M, int nv, ...) {
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
