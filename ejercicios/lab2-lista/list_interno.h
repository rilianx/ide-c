// Estructura interna de la lista enlazada doble (solo lectura).
#ifndef List_interno_h
#define List_interno_h

#include <stdio.h>
#include <stdlib.h>
#include "list.h"

typedef struct Node Node;

struct Node {
    void * data; // Puntero al dato
    Node * next; // Puntero al siguiente nodo
    Node * prev; // Puntero al nodo previo
};

struct List {
    Node * head;    // Puntero al primer elemento
    Node * tail;    // Puntero al ultimo elemento
    Node * current; // Puntero para poder recorrer la lista
};

// Crea, inicializa y retorna un nodo con el dato (next y prev en NULL).
Node * createNode(void * data);

#endif /* List_interno_h */
