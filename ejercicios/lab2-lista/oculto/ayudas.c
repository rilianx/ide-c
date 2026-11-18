// Ayudas para los tests (ocultas). Usan solo la interfaz de list.h.
#include <stdio.h>
#include <stdlib.h>
#include "list.h"

// Un entero en memoria dinámica, para guardarlo en la lista.
int * entero(int v) {
    int * p = (int *)malloc(sizeof(int));
    *p = v;
    return p;
}

// Imprime un dato (int *) o NULL.
void dato(void * p) {
    if (p == NULL) printf("NULL\n");
    else printf("%d\n", *(int *)p);
}

// Lista con los n valores dados, armada con pushBack.
List * listaCon(int n, const int * valores) {
    List * L = createList();
    for (int i = 0; i < n; i++) pushBack(L, entero(valores[i]));
    return L;
}

// Recorre con firstList/nextList: [1, 2, 3]  (corta en 20 por si hay un ciclo)
void mostrar(List * L) {
    printf("[");
    int i = 0;
    for (int * p = firstList(L); p != NULL && i < 20; p = nextList(L), i++)
        printf(i ? ", %d" : "%d", *p);
    printf(i == 20 ? ", ...]\n" : "]\n");
}

// Recorre con lastList/prevList: [3, 2, 1]
void mostrarReves(List * L) {
    printf("[");
    int i = 0;
    for (int * p = lastList(L); p != NULL && i < 20; p = prevList(L), i++)
        printf(i ? ", %d" : "%d", *p);
    printf(i == 20 ? ", ...]\n" : "]\n");
}
