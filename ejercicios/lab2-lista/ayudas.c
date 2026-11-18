// ayudas.c: funciones auxiliares que usan los tests.
// NO se deben cambiar (este archivo es de solo lectura).
//
// Cada test arma una lista de entrada (listaCon, irA), llama a tu función y muestra
// lo que retorna (retorno) y cómo quedó la lista (resultado). Estas funciones trabajan
// directo sobre los structs de list.h, sin llamar a tus funciones.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <unistd.h>
#include "list.h"

// ¿El puntero apunta a memoria reservada? (para no caerse con punteros basura)
static int valido(void * p) {
    uintptr_t a = (uintptr_t)p;
    return p != NULL && a % sizeof(void *) == 0 && a > 4096 && a < (uintptr_t)sbrk(0);
}

// Un entero en memoria dinámica, para guardarlo como dato de la lista.
int * entero(int v) {
    int * p = (int *)malloc(sizeof(int));
    *p = v;
    return p;
}

// Arma una lista con los n valores dados (sin usar tus funciones). Deja current en NULL.
List * listaCon(int n, const int * valores) {
    List * L = (List *)malloc(sizeof(List));
    L->head = L->tail = L->current = NULL;
    for (int i = 0; i < n; i++) {
        Node * nodo = (Node *)malloc(sizeof(Node));
        nodo->data = entero(valores[i]);
        nodo->next = NULL;
        nodo->prev = L->tail;
        if (L->tail != NULL) L->tail->next = nodo;
        else L->head = nodo;
        L->tail = nodo;
    }
    return L;
}

// Deja current en el nodo de posición i (0 es el primero).
void irA(List * L, int i) {
    L->current = L->head;
    while (i-- > 0 && L->current != NULL) L->current = L->current->next;
}

// Llena la memoria libre con basura (para notar campos que no se inicializan).
void ensuciarMemoria(void) {
    void * p[8];
    for (int i = 0; i < 8; i++) { p[i] = malloc(sizeof(List)); memset(p[i], 0x5A, sizeof(List)); }
    for (int i = 7; i >= 0; i--) free(p[i]);
}

// Imprime el dato al que apunta un void * (o NULL, o basura).
static void dato(void * p) {
    if (p == NULL) printf("NULL");
    else if (!valido(p)) printf("basura");
    else printf("%d", *(int *)p);
}

// Imprime el dato de un nodo (o NULL, o basura).
static void nodo(Node * n) {
    if (n == NULL) printf("NULL");
    else if (!valido(n)) printf("basura");
    else dato(n->data);
}

// Lo que retornó una función: «retorna: 2» (o NULL).
void retorno(void * p) {
    printf("retorna: ");
    dato(p);
    printf("\n");
}

// Cómo quedó la lista:
//   lista: [1, 2, 3]                      (recorrida desde head con next)
//   head: 1, tail: 3, current: 2          (current solo si conCurrent)
//   enlaces: bien                         (o el primer problema con prev, head o tail)
void resultado(List * L, int conCurrent) {
    if (L == NULL) { printf("lista: NULL\n"); return; }
    if (!valido(L)) { printf("lista: basura\n"); return; }
    printf("lista: [");
    int i = 0;
    Node * n = L->head;
    for (; n != NULL && valido(n) && i < 20; n = n->next, i++) { if (i) printf(", "); dato(n->data); }
    printf(n != NULL ? (i == 20 ? ", ...]\n" : ", basura]\n") : "]\n");
    printf("head: "); nodo(L->head);
    printf(", tail: "); nodo(L->tail);
    if (conCurrent) { printf(", current: "); nodo(L->current); }
    printf("\n");
    // enlaces
    printf("enlaces: ");
    if (L->head == NULL || L->tail == NULL) {
        printf(L->head != L->tail ? "problema: uno de head y tail es NULL y el otro no\n" : "bien\n");
        return;
    }
    if (!valido(L->head) || !valido(L->tail)) { printf("problema: head o tail tiene basura\n"); return; }
    if (L->head->prev != NULL) { printf("problema: head->prev no es NULL\n"); return; }
    n = L->head;
    for (i = 0; n->next != NULL; i++) {
        if (i == 100 || !valido(n->next)) { printf("problema: next lleva a basura o hay un ciclo\n"); return; }
        if (n->next->prev != n) {
            printf("problema: el prev del "); dato(n->next->data); printf(" no apunta al "); dato(n->data); printf("\n");
            return;
        }
        n = n->next;
    }
    if (n != L->tail) { printf("problema: tail no apunta al último nodo\n"); return; }
    printf("bien\n");
}
