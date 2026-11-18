#ifndef List_h
#define List_h

#include <stdio.h>
#include <stdlib.h>

typedef struct Node Node;
typedef struct List List;

// Nodo de la lista enlazada doble.
struct Node {
    void * data; // Puntero al dato
    Node * next; // Puntero al siguiente nodo
    Node * prev; // Puntero al nodo previo
};

// La lista: guarda el primero, el último y el nodo actual del recorrido.
struct List {
    Node * head;    // Puntero al primer elemento
    Node * tail;    // Puntero al ultimo elemento
    Node * current; // Puntero para poder recorrer la lista
};

// Crea, inicializa y retorna un nodo con el dato (next y prev en NULL).
Node * createNode(void * data);

List * createList(void);

void * firstList(List * list);

void * nextList(List * list);

void * lastList(List * list);

void * prevList(List * list);

void pushFront(List * list, void * data);

void pushBack(List * list, void * data);

void pushCurrent(List * list, void * data);

void * popFront(List * list);

void * popBack(List * list);

void * popCurrent(List * list);

void cleanList(List * list);

#endif /* List_h */
