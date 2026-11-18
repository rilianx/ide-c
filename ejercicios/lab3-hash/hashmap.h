#ifndef HashMap_h
#define HashMap_h

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

typedef struct Pair Pair;
typedef struct HashMap HashMap;

// Un par (clave, valor). Un par con key == NULL es un par inválido (se eliminó).
struct Pair {
    char * key;     // la clave (un texto)
    void * value;   // el valor asociado
};

// La tabla hash: un arreglo de punteros a Pair (una casilla puede ser NULL).
struct HashMap {
    Pair ** buckets;   // arreglo de capacity casillas
    long size;         // cantidad de pares válidos en la tabla
    long capacity;     // capacidad del arreglo buckets
    long current;      // índice del último dato accedido
};

// Crea un par con la clave y el valor dados.
Pair * createPair(char * key, void * value) {
    Pair * new = (Pair *)malloc(sizeof(Pair));
    new->key = key;
    new->value = value;
    return new;
}

// Transforma una clave en una posición entre 0 y capacity - 1.
long hash(char * key, long capacity) {
    unsigned long long hash = 0;
    char * ptr;
    for (ptr = key; *ptr != '\0'; ptr++) {
        hash += hash * 32 + tolower(*ptr);
    }
    return hash % capacity;
}

// Retorna 1 si las dos claves son iguales; 0 si no (o si alguna es NULL).
int is_equal(void * key1, void * key2) {
    if (key1 == NULL || key2 == NULL) return 0;
    if (strcmp((char *)key1, (char *)key2) == 0) return 1;
    return 0;
}

HashMap * createMap(long capacity);

void insertMap(HashMap * map, char * key, void * value);

Pair * searchMap(HashMap * map, char * key);

void eraseMap(HashMap * map, char * key);

Pair * firstMap(HashMap * map);

Pair * nextMap(HashMap * map);

void enlarge(HashMap * map);

#endif /* HashMap_h */
