// ayudas.c: funciones auxiliares que usan los tests.
// NO se deben cambiar (este archivo es de solo lectura).
//
// Trabajan directo sobre los structs de list.h, sin llamar a tus funciones:
// así cada test depende solo de la función que está probando.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "list.h"

// Un entero en memoria dinámica, para guardarlo como dato de la lista.
int * entero(int v) {
    int * p = (int *)malloc(sizeof(int));
    *p = v;
    return p;
}

// Imprime un dato (el int al que apunta) o NULL.
void dato(void * p) {
    if (p == NULL) printf("NULL\n");
    else printf("%d\n", *(int *)p);
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

// Imprime la lista recorriéndola desde head con next: [1, 2, 3]
// (corta en 20 nodos, por si quedó un ciclo).
void mostrar(List * L) {
    printf("[");
    int i = 0;
    for (Node * n = L->head; n != NULL && i < 20; n = n->next, i++)
        printf(i ? ", %d" : "%d", *(int *)n->data);
    printf(i == 20 ? ", ...]\n" : "]\n");
}

// Imprime la lista al revés, desde tail con prev: [3, 2, 1]
void mostrarReves(List * L) {
    printf("[");
    int i = 0;
    for (Node * n = L->tail; n != NULL && i < 20; n = n->prev, i++)
        printf(i ? ", %d" : "%d", *(int *)n->data);
    printf(i == 20 ? ", ...]\n" : "]\n");
}

// Imprime el dato de cada nodo al que apuntan head, tail y current (o NULL):
// head: 1, tail: 3, current: NULL
void estado(List * L) {
    Node * p[3] = { L->head, L->tail, L->current };
    const char * nombre[3] = { "head", "tail", "current" };
    for (int i = 0; i < 3; i++) {
        printf(i ? ", %s: " : "%s: ", nombre[i]);
        if (p[i] == NULL) printf("NULL");
        else printf("%d", *(int *)p[i]->data);
    }
    printf("\n");
}

// Imprime solo head y tail: head: 1, tail: 3
void extremos(List * L) {
    printf("head: ");
    if (L->head == NULL) printf("NULL"); else printf("%d", *(int *)L->head->data);
    printf(", tail: ");
    if (L->tail == NULL) printf("NULL"); else printf("%d", *(int *)L->tail->data);
    printf("\n");
}

// Revisa que los enlaces sean consistentes: head->prev es NULL, cada nodo es el prev
// de su siguiente y tail es el último. Imprime "enlaces bien" o el primer problema.
void revisar(List * L) {
    if (L->head == NULL || L->tail == NULL) {
        if (L->head != L->tail) printf("problema: uno de head y tail es NULL y el otro no\n");
        else printf("enlaces bien\n");
        return;
    }
    if (L->head->prev != NULL) { printf("problema: head->prev no es NULL\n"); return; }
    Node * n = L->head;
    for (int i = 0; n->next != NULL; i++) {
        if (i == 100) { printf("problema: la lista tiene un ciclo\n"); return; }
        if (n->next->prev != n) {
            printf("problema: el prev del %d no apunta al %d\n", *(int *)n->next->data, *(int *)n->data);
            return;
        }
        n = n->next;
    }
    if (n != L->tail) { printf("problema: tail no apunta al último nodo\n"); return; }
    printf("enlaces bien\n");
}

// Llena la memoria libre con basura (para notar campos que no se inicializan).
void ensuciarMemoria(void) {
    void * p[8];
    for (int i = 0; i < 8; i++) { p[i] = malloc(sizeof(List)); memset(p[i], 0x5A, sizeof(List)); }
    for (int i = 7; i >= 0; i--) free(p[i]);
}
