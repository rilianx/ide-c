// ayudas.c: funciones auxiliares que usan los tests.
// NO se deben cambiar (este archivo es de solo lectura).
//
// Cada test arma una tabla de entrada (tablaCon), llama a tu función y muestra lo que
// retorna (retorno) y cómo quedó la tabla (resultado). Estas funciones trabajan directo
// sobre los structs de hashmap.h, sin llamar a tus funciones.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <unistd.h>
#include "hashmap.h"

// ¿El puntero apunta a memoria reservada? (para no caerse con punteros basura)
static int valido(void * p) {
    uintptr_t a = (uintptr_t)p;
    return p != NULL && a > 4096 && a < (uintptr_t)sbrk(0);
}

// Un entero en memoria dinámica, para guardarlo como valor de un par.
int * entero(int v) {
    int * p = (int *)malloc(sizeof(int));
    *p = v;
    return p;
}

// Arma una tabla con capacity casillas: claves[i] es la clave de la casilla i (NULL: casilla
// vacía; "~x": un par inválido, con key NULL). Los valores son 1, 2, 3… en orden.
// size queda en la cantidad de pares válidos y current en -1.
HashMap * tablaCon(long capacity, char ** claves) {
    HashMap * map = (HashMap *)malloc(sizeof(HashMap));
    map->buckets = (Pair **)calloc(capacity, sizeof(Pair *));
    map->capacity = capacity;
    map->size = 0;
    map->current = -1;
    int v = 1;
    for (long i = 0; i < capacity; i++) {
        if (claves[i] == NULL) continue;
        if (claves[i][0] == '~') map->buckets[i] = createPair(NULL, entero(v++));
        else { map->buckets[i] = createPair(claves[i], entero(v++)); map->size++; }
    }
    return map;
}

// Llena la memoria libre con basura (para notar campos que no se inicializan).
void ensuciarMemoria(void) {
    void * p[12];
    for (int i = 0; i < 12; i++) { p[i] = malloc(i < 6 ? sizeof(HashMap) : 16 * sizeof(Pair *)); memset(p[i], 0x5A, i < 6 ? sizeof(HashMap) : 16 * sizeof(Pair *)); }
    for (int i = 11; i >= 0; i--) free(p[i]);
}

// Imprime la clave de un par (o NULL, o basura).
static void clave(Pair * p) {
    if (p == NULL) printf("NULL");
    else if (!valido(p)) printf("basura");
    else if (p->key == NULL) printf("(par inválido)");
    else if (!valido(p->key)) printf("basura");
    else printf("%s", p->key);
}

// Lo que retornó una función: «retorna: casa» (la clave del par) o NULL.
void retorno(Pair * p) {
    printf("retorna: ");
    clave(p);
    printf("\n");
}

// Cómo quedó la tabla:
//   tabla: [olla, -, case, -, ~, ...]       (- casilla vacía, ~ par inválido)
//   size: 6, capacity: 10, current: 2       (current solo si conCurrent)
void resultado(HashMap * map, int conCurrent) {
    if (map == NULL) { printf("tabla: NULL\n"); return; }
    if (!valido(map)) { printf("tabla: basura\n"); return; }
    if (map->capacity < 1 || map->capacity > 64) printf("tabla: (capacity con basura)\n");
    else if (!valido(map->buckets)) printf("tabla: buckets %s\n", map->buckets == NULL ? "NULL" : "basura");
    else {
        printf("tabla: [");
        for (long i = 0; i < map->capacity; i++) {
            Pair * p = map->buckets[i];
            if (i) printf(", ");
            if (p == NULL) printf("-");
            else if (!valido(p)) printf("basura");
            else if (p->key == NULL) printf("~");
            else if (!valido(p->key)) printf("basura");
            else printf("%s", p->key);
        }
        printf("]\n");
    }
    printf("size: %ld, capacity: %ld", map->size, map->capacity);
    if (conCurrent) printf(", current: %ld", map->current);
    printf("\n");
}
